import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { NodeIO, type Document, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import {
  bakeShorePixels, isShoreCovered, sampleShorePixels, sliceShore, SHORE_BAKE_LAYOUT,
  type ShoreMesh,
} from '../ocean/shoreFieldBake';
import {
  isProtectedTerrainTriangle, reshapeTerrainPoint,
  TERRAIN_OUTLINE_VERSION, TERRAIN_PLACEMENT, type TerrainPoint,
} from './terrainOutline';
import { createTerrainSkirtFromRim, type TerrainRimPoint } from './terrainSkirt';
import { terrainFaceOrientation } from './terrainOrientation';
import { repairTerrainDiagonals } from './terrainDiagonals';
import { createTerrainContinuation } from './terrainContinuation';

export const TERRAIN_SOURCE_REF = '6a02c49edb33b30e4f0c6d416a5a32fb3f43e03d';
export const TERRAIN_SOURCES = [
  { variant: 'optimized', file: 'terrain-opt.glb', sha256: '643b8c00fc6acf030096acbe269f21e06a23fc65324f9bdcc46a268e1308a474' },
  { variant: 'software', file: 'terrain-software.glb', sha256: 'ef190fdb33d48c8df1f857bc1d8c1bdca01318e7fcf95c66d4accb05e4e925f2' },
] as const;
export const TERRAIN_REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const placement = new THREE.Matrix4().compose(
  new THREE.Vector3(...TERRAIN_PLACEMENT.position),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...TERRAIN_PLACEMENT.rotation)),
  new THREE.Vector3(...TERRAIN_PLACEMENT.scale),
);

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function createTerrainIO(): Promise<NodeIO> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

export function readTerrainSource(source: typeof TERRAIN_SOURCES[number]): Uint8Array {
  let bytes: Buffer;
  try {
    bytes = execFileSync('git', ['show', `${TERRAIN_SOURCE_REF}:public/models/${source.file}`], {
      cwd: TERRAIN_REPOSITORY, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (cause) {
    throw new Error(
      `Cannot read pristine ${source.file} at ${TERRAIN_SOURCE_REF}. ` +
      `Restore history with "git fetch origin ${TERRAIN_SOURCE_REF}" and rerun "bun run bake:island". ` +
      'The current, potentially already-shaped asset will NOT be used as input.',
      { cause },
    );
  }
  if (sha256(bytes) !== source.sha256) throw new Error(`Pristine terrain fingerprint mismatch: ${source.file}`);
  return bytes;
}

function requireAttribute(primitive: Primitive, name: string) {
  const attribute = primitive.getAttribute(name);
  if (!attribute) throw new Error(`Terrain primitive is missing ${name}.`);
  return attribute;
}

function pointAt(positions: Float64Array, vertex: number): TerrainPoint {
  return [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
}

export function terrainRecords(document: Document) {
  return document.getRoot().listNodes().flatMap(node => {
    const mesh = node.getMesh();
    if (!mesh) return [];
    return mesh.listPrimitives().map(primitive => {
      const position = requireAttribute(primitive, 'POSITION');
      const uv = requireAttribute(primitive, 'TEXCOORD_0');
      const world = placement.clone().multiply(new THREE.Matrix4().fromArray(node.getWorldMatrix()));
      const positions = new Float64Array(position.getCount() * 3);
      const point = new THREE.Vector3();
      const element: number[] = [];
      for (let vertex = 0; vertex < position.getCount(); vertex += 1) {
        point.fromArray(position.getElement(vertex, element)).applyMatrix4(world);
        positions.set([point.x, point.y, point.z], vertex * 3);
      }
      return {
        primitive, position, uv, world, positions,
        normal: primitive.getAttribute('NORMAL'),
        indices: primitive.getIndices()?.getArray() ?? null,
      };
    });
  });
}

type TerrainRecord = ReturnType<typeof terrainRecords>[number];

function visitRecord(record: TerrainRecord, visit: (a: number, b: number, c: number) => void) {
  const count = record.indices?.length ?? record.position.getCount();
  if (count % 3 !== 0) throw new Error('Terrain primitive is not a triangle list.');
  for (let index = 0; index < count; index += 3) {
    visit(record.indices?.[index] ?? index, record.indices?.[index + 1] ?? index + 1, record.indices?.[index + 2] ?? index + 2);
  }
}

function positionKey(point: TerrainPoint): string {
  return point.map(value => Math.round(value * 100)).join(',');
}

function protectedVertices(records: readonly TerrainRecord[]): Set<string> {
  const protectedKeys = new Set<string>();
  for (const record of records) {
    visitRecord(record, (a, b, c) => {
      const points = [pointAt(record.positions, a), pointAt(record.positions, b), pointAt(record.positions, c)] as const;
      if (isProtectedTerrainTriangle(...points)) {
        points.forEach(point => protectedKeys.add(positionKey(point)));
      }
    });
  }
  return protectedKeys;
}

function borderStations(records: readonly TerrainRecord[]) {
  const stations: { parameter: number; record: number; vertex: number }[] = [];
  records.forEach((record, recordIndex) => {
    for (let vertex = 0; vertex < record.position.getCount(); vertex += 1) {
      const [u, v] = record.uv.getElement(vertex, [0, 0]);
      // UVs retain the authored outer grid line through both position quantizations.
      const distances = [Math.abs(1 - v), Math.abs(1 - u), Math.abs(v), Math.abs(u)];
      const nearest = Math.min(...distances);
      if (nearest > 0.00025) continue;
      const side = distances.indexOf(nearest);
      const along = [u, 1 - v, 1 - u, v][side];
      stations.push({
        parameter: (side + Math.max(0, Math.min(1, along))) % 4,
        record: recordIndex,
        vertex,
      });
    }
  });
  stations.sort((a, b) => a.parameter - b.parameter);
  if (stations.length < 64) throw new Error('Cannot identify the original terrain boundary.');
  return stations;
}

function decodedRim(records: readonly TerrainRecord[], stations: ReturnType<typeof borderStations>): TerrainRimPoint[] {
  const rim: TerrainRimPoint[] = [];
  const parameters: number[] = [];
  for (const station of stations) {
    const record = records[station.record];
    const point = pointAt(record.positions, station.vertex);
    const [u, v] = record.uv.getElement(station.vertex, [0, 0]);
    const entry: TerrainRimPoint = [point[0], point[1], point[2], u, v];
    const last = rim.length - 1;
    if (last >= 0 && station.parameter - parameters[last] < 0.0001) {
      const previous = rim[last];
      if (Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]) > 0.025) {
        throw new Error('Final terrain boundary has an inconsistent join.');
      }
      if (entry[1] > previous[1]) rim[last] = entry;
      continue;
    }
    rim.push(entry);
    parameters.push(station.parameter);
  }
  if (parameters[0] + 4 - parameters[parameters.length - 1] < 0.0001) rim.pop();
  return rim;
}

export function measureTerrainRimJoin(
  final: readonly TerrainRecord[], rim: readonly TerrainRimPoint[],
): number {
  let maximum = 0;
  for (const station of borderStations(final)) {
    const point = pointAt(final[station.record].positions, station.vertex);
    let nearest = Infinity;
    for (let index = 0; index < rim.length; index += 1) {
      const a = rim[index];
      const b = rim[(index + 1) % rim.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const lengthSquared = dx * dx + dy * dy + dz * dz;
      if (lengthSquared < 1e-14) throw new Error('Terrain boundary contains a collapsed segment.');
      const t = Math.max(0, Math.min(1, (
        (point[0] - a[0]) * dx + (point[1] - a[1]) * dy + (point[2] - a[2]) * dz
      ) / lengthSquared));
      nearest = Math.min(nearest, Math.hypot(
        point[0] - a[0] - t * dx, point[1] - a[1] - t * dy, point[2] - a[2] - t * dz,
      ));
    }
    maximum = Math.max(maximum, nearest);
  }
  if (maximum > 0.025) throw new Error(`Terrain/skirt join misses a decoded border vertex by ${maximum} units.`);
  return maximum;
}

function typedBytes(array: ArrayBufferView): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

function attributeFingerprint(record: TerrainRecord, name: string): string {
  const attribute = record.primitive.getAttribute(name);
  const array = attribute?.getArray();
  return array ? sha256(typedBytes(array)) : '';
}

function textures(document: Document): string[] {
  return document.getRoot().listTextures().map(texture => {
    const image = texture.getImage();
    if (!image) throw new Error('Terrain has an unresolved texture.');
    return sha256(image);
  });
}

export function surfaceFromSkirt(rim: readonly TerrainRimPoint[]): ShoreMesh {
  const geometry = createTerrainSkirtFromRim(rim);
  const positions = Float64Array.from(geometry.getAttribute('position').array);
  const indices = geometry.getIndex()!.array.slice();
  geometry.dispose();
  return { positions, indices };
}

export function surfaceFromContinuation(rim: readonly TerrainRimPoint[]): ShoreMesh {
  const geometry = createTerrainContinuation(rim);
  const positions = Float64Array.from(geometry.getAttribute('position').array);
  const indices = geometry.getIndex()!.array.slice();
  geometry.dispose();
  return { positions, indices };
}

export function verifyShoreRegistration(
  pixels: Uint8Array, meshes: readonly ShoreMesh[], coveringMeshes: readonly ShoreMesh[] = [],
): number {
  const segments = sliceShore(meshes);
  if (!segments.length) throw new Error('Final terrain has no waterline intersection.');
  let maximumError = 0;
  for (const [a, b] of segments) {
    for (let sample = 0; sample <= 4; sample += 1) {
      const t = sample / 4;
      const x = a[0] + t * (b[0] - a[0]);
      const z = a[1] + t * (b[1] - a[1]);
      if (isShoreCovered(coveringMeshes, x, z)) continue;
      maximumError = Math.max(maximumError, Math.abs(sampleShorePixels(
        pixels, x, z,
      )));
    }
  }
  if (maximumError > 0.8) {
    throw new Error(`Shore field misses the final coastline by ${maximumError.toFixed(4)} world units (limit 0.8).`);
  }
  return maximumError;
}

export async function reshapeTerrainAsset(io: NodeIO, source: typeof TERRAIN_SOURCES[number]) {
  const document = await io.readBinary(readTerrainSource(source));
  const before = terrainRecords(document);
  const textureHashes = textures(document);
  const pins = protectedVertices(before);
  const masks: Uint8Array[] = [];
  const vertexOrigins: (Uint32Array | null)[] = [];
  const rawPositions = before.map(record => record.position.getArray()!.slice());
  const rawNormals = before.map(record => record.normal?.getArray()?.slice());
  const uvHashes = before.map(record => attributeFingerprint(record, 'TEXCOORD_0'));
  const indexHashes = before.map(record => record.indices ? sha256(typedBytes(record.indices)) : '');
  let pinnedVertices = 0;
  let diagonalFlips = 0;
  let retriangulatedFaces = 0;
  for (const [recordIndex, record] of before.entries()) {
    const inverse = record.world.clone().invert();
    const moved = new Uint8Array(record.position.getCount());
    const point = new THREE.Vector3();
    for (let vertex = 0; vertex < record.position.getCount(); vertex += 1) {
      const original = pointAt(record.positions, vertex);
      if (pins.has(positionKey(original))) {
        pinnedVertices += 1;
        continue;
      }
      const shaped = reshapeTerrainPoint(original);
      if (shaped === original) continue;
      point.set(...shaped).applyMatrix4(inverse);
      if (record.position.getNormalized() && Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) > 1) {
        throw new Error('Fringe exceeds the existing position encoding; refusing global requantization.');
      }
      record.position.setElement(vertex, point.toArray());
      const encoded = record.position.getArray()!;
      if ([0, 1, 2].some(axis => encoded[vertex * 3 + axis] !== rawPositions[recordIndex][vertex * 3 + axis])) {
        moved[vertex] = 1;
      }
    }
    const shapedPositions = new Float64Array(record.positions.length);
    for (let vertex = 0; vertex < record.position.getCount(); vertex += 1) {
      point.fromArray(record.position.getElement(vertex, [])).applyMatrix4(record.world);
      shapedPositions.set([point.x, point.y, point.z], vertex * 3);
    }
    const originalTriangles = record.indices ?? Uint32Array.from({ length: record.position.getCount() }, (_, index) => index);
    const repair = repairTerrainDiagonals(record.positions, shapedPositions, originalTriangles, moved);
    diagonalFlips += repair.flips;
    retriangulatedFaces += repair.changedFaces.size;
    if (record.indices) {
      const indices = record.indices.slice();
      indices.set(repair.triangles);
      record.primitive.getIndices()!.setArray(indices);
      record.indices = indices;
      vertexOrigins.push(null);
    } else {
      vertexOrigins.push(repair.triangles);
      for (const attribute of [record.position, record.uv]) {
        const values = attribute.getArray()!;
        const replacement = values.slice();
        const size = attribute.getElementSize();
        for (const face of repair.changedFaces) {
          for (let corner = face * 3; corner < face * 3 + 3; corner += 1) {
            for (let axis = 0; axis < size; axis += 1) {
              replacement[corner * size + axis] = values[repair.triangles[corner] * size + axis];
            }
          }
        }
        attribute.setArray(replacement);
      }
    }
    uvHashes[recordIndex] = attributeFingerprint(record, 'TEXCOORD_0');
    indexHashes[recordIndex] = record.indices ? sha256(typedBytes(record.indices)) : '';
    masks.push(moved);
    if (record.normal) {
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      visitRecord(record, (ia, ib, ic) => {
        if (!moved[ia] && !moved[ib] && !moved[ic]) return;
        // Optimized terrain has split face normals; software has no normal stream.
        if (record.indices) throw new Error('Indexed smooth terrain needs a different fringe-normal bake.');
        a.fromArray(record.position.getElement(ia, []));
        b.fromArray(record.position.getElement(ib, [])).sub(a);
        c.fromArray(record.position.getElement(ic, [])).sub(a);
        b.cross(c).normalize();
        for (const vertex of [ia, ib, ic]) record.normal!.setElement(vertex, b.toArray());
      });
    }
  }
  // Only lossless buffer encoding: no simplify(), reorder(), or quantize().
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });
  document.getRoot().setExtras({
    ...document.getRoot().getExtras(),
    terrainOutline: { version: TERRAIN_OUTLINE_VERSION, sourceRef: TERRAIN_SOURCE_REF, sourceSha256: source.sha256 },
  });
  const bytes = await io.writeBinary(document);
  const decoded = await io.readBinary(bytes);
  const after = terrainRecords(decoded);
  if (after.length !== before.length || JSON.stringify(textures(decoded)) !== JSON.stringify(textureHashes)) {
    throw new Error('Terrain bake changed meshes or original texture bytes.');
  }
  let unchangedVertices = 0;
  let changedVertices = 0;
  let unchangedNormalVertices = 0;
  let maximumDisplacement = 0;
  let minimumOrientationCosine = 1;
  let minimumJacobianDeterminant = 1;
  let triangles = 0;
  after.forEach((record, index) => {
    const previous = before[index];
    const origins = vertexOrigins[index];
    if (record.position.getCount() !== previous.position.getCount() ||
        record.indices?.length !== previous.indices?.length ||
        (record.indices ? sha256(typedBytes(record.indices)) : '') !== indexHashes[index] ||
        attributeFingerprint(record, 'TEXCOORD_0') !== uvHashes[index]) {
      throw new Error('Terrain bake changed topology or surface UVs.');
    }
    const encoded = record.position.getArray()!;
    for (let vertex = 0; vertex < record.position.getCount(); vertex += 1) {
      const point = pointAt(record.positions, vertex);
      const original = pointAt(previous.positions, origins?.[vertex] ?? vertex);
      maximumDisplacement = Math.max(maximumDisplacement, Math.hypot(
        point[0] - original[0], point[1] - original[1], point[2] - original[2],
      ));
      let changed = false;
      for (let axis = 0; axis < 3; axis += 1) {
        if (encoded[vertex * 3 + axis] !== rawPositions[index][vertex * 3 + axis]) {
          changed = true;
        }
      }
      if (changed && !masks[index][vertex]) {
        throw new Error('Lossless encoding moved an unchanged interior/protected vertex.');
      }
      if (changed) changedVertices += 1;
      else unchangedVertices += 1;
    }
    visitRecord(record, (a, b, c) => {
      triangles += 1;
      const original = [
        pointAt(previous.positions, origins?.[a] ?? a),
        pointAt(previous.positions, origins?.[b] ?? b),
        pointAt(previous.positions, origins?.[c] ?? c),
      ] as const;
      const result = [pointAt(record.positions, a), pointAt(record.positions, b), pointAt(record.positions, c)] as const;
      if (masks[index][a] || masks[index][b] || masks[index][c]) {
        const orientation = terrainFaceOrientation(original, result);
        minimumOrientationCosine = Math.min(minimumOrientationCosine, orientation.cosine);
        minimumJacobianDeterminant = Math.min(minimumJacobianDeterminant, orientation.jacobianDeterminant);
        if (orientation.cosine <= 0 || orientation.jacobianDeterminant <= 0) {
          throw new Error(`Terrain fringe contains a 3D orientation reversal: ${JSON.stringify({
            variant: source.variant, record: index, vertices: [a, b, c], original, result, ...orientation,
          })}`);
        }
      }
      if (isProtectedTerrainTriangle(...original) &&
          [a, b, c].some(vertex => masks[index][vertex])) {
        throw new Error('A triangle beneath a protected contact zone was reshaped.');
      }
      if (record.normal && !masks[index][a] && !masks[index][b] && !masks[index][c]) {
        const normal = record.normal.getArray()!;
        const oldNormal = rawNormals[index]!;
        for (const vertex of [a, b, c]) {
          for (let axis = 0; axis < 3; axis += 1) {
            if (normal[vertex * 3 + axis] !== oldNormal[vertex * 3 + axis]) {
              throw new Error('Unchanged interior face normals changed during encoding.');
            }
          }
          unchangedNormalVertices += 1;
        }
      }
    });
  });
  const round = (value: number) => Number(value.toFixed(6));
  const roundedRim = decodedRim(after, borderStations(after)).map((point): TerrainRimPoint => [
    round(point[0]), round(point[1]), round(point[2]), round(point[3]), round(point[4]),
  ]);
  const samePosition = (a: TerrainRimPoint, b: TerrainRimPoint) =>
    a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const rim = roundedRim.filter((point, index) => index === 0 || !samePosition(point, roundedRim[index - 1]));
  if (samePosition(rim[0], rim[rim.length - 1])) rim.pop();
  // Legacy patch seams carry slightly different UV stations for the same edge.
  // Order their final XZ silhouette, rather than allowing millimetre backtracks.
  const boundaryAngle = (point: TerrainRimPoint) =>
    (Math.atan2(point[2] + 20, point[0]) + Math.PI * 2) % (Math.PI * 2);
  rim.sort((a, b) => boundaryAngle(a) - boundaryAngle(b));
  const maximumRimJoinError = measureTerrainRimJoin(after, rim);
  const skirt = surfaceFromSkirt(rim);
  const continuation = surfaceFromContinuation(rim);
  return {
    bytes, rim, continuation, meshes: [...after, skirt, continuation],
    stats: {
      variant: source.variant, sourceSha256: source.sha256, sha256: sha256(bytes), bytes: bytes.length,
      meshes: after.length, triangles, vertices: after.reduce((sum, record) => sum + record.position.getCount(), 0),
      changedVertices, unchangedVertices, unchangedNormalVertices, pinnedVertices, maximumDisplacement,
      minimumOrientationCosine, minimumJacobianDeterminant,
      diagonalFlips, retriangulatedFaces,
      rimVertices: rim.length, rimSha256: sha256(Buffer.from(JSON.stringify(rim))),
      skirtTriangles: skirt.indices!.length / 3, maximumRimJoinError,
      continuationTriangles: continuation.indices!.length / 3,
    },
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, bytes: Uint8Array): Buffer {
  const chunk = Buffer.alloc(bytes.length + 12);
  chunk.writeUInt32BE(bytes.length);
  chunk.write(type, 4, 4, 'ascii');
  chunk.set(bytes, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, bytes.length + 8)), bytes.length + 8);
  return chunk;
}

export function encodeShorePng(pixels: Uint8Array, resolution = SHORE_BAKE_LAYOUT.resolution): Buffer {
  if (pixels.length !== resolution * resolution) throw new Error('Shore PNG dimensions do not match its pixels.');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(resolution, 0);
  header.writeUInt32BE(resolution, 4);
  header[8] = 8;
  const rows = Buffer.alloc((resolution + 1) * resolution);
  for (let row = 0; row < resolution; row += 1) {
    rows.set(pixels.subarray(row * resolution, (row + 1) * resolution), row * (resolution + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows, { level: 9 })), pngChunk('IEND', new Uint8Array()),
  ]);
}

/** Read back the committed, unfiltered grayscale data instead of trusting a bake report. */
export function decodeShorePng(png: Uint8Array): Uint8Array {
  const bytes = Buffer.from(png);
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Invalid shore PNG signature.');
  }
  const resolution = bytes.readUInt32BE(16);
  if (resolution !== bytes.readUInt32BE(20) || bytes[24] !== 8 || bytes[25] !== 0) {
    throw new Error('Shore PNG must be square, 8-bit grayscale.');
  }
  const parts: Uint8Array[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    if (bytes.readUInt32BE(offset + size + 8) !== crc32(bytes.subarray(offset + 4, offset + size + 8))) {
      throw new Error('Shore PNG checksum failed.');
    }
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') parts.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const rows = inflateSync(Buffer.concat(parts));
  if (rows.length !== resolution * (resolution + 1)) throw new Error('Shore PNG has invalid scanlines.');
  const pixels = new Uint8Array(resolution * resolution);
  for (let row = 0; row < resolution; row += 1) {
    const offset = row * (resolution + 1);
    if (rows[offset] !== 0) throw new Error('Unexpected shore PNG filter; rerun its deterministic baker.');
    pixels.set(rows.subarray(offset + 1, offset + resolution + 1), row * resolution);
  }
  return pixels;
}

export async function bakeTerrainAssets(): Promise<void> {
  const io = await createTerrainIO();
  const results = [];
  for (const source of TERRAIN_SOURCES) results.push(await reshapeTerrainAsset(io, source));
  const pixels = bakeShorePixels(results[0].meshes);
  const registration = results.map(result => verifyShoreRegistration(pixels, result.meshes, [result.continuation]));
  const png = encodeShorePng(pixels);
  const profile = results.map((result, index) =>
    `export const ${index ? 'TERRAIN_SOFTWARE_RIM' : 'TERRAIN_RIM'}: readonly TerrainRimPoint[] = [\n` +
    result.rim.map(point => `  [${point.map(value => Number(value.toFixed(6))).join(', ')}],`).join('\n') +
    '\n];\n',
  ).join('\n');
  const manifest = {
    version: TERRAIN_OUTLINE_VERSION, sourceRef: TERRAIN_SOURCE_REF,
    variants: results.map((result, index) => ({ ...result.stats, maximumShoreError: registration[index] })),
    shore: { ...SHORE_BAKE_LAYOUT, bytes: png.length, sha256: sha256(png) },
  };
  // Validate everything before replacing any committed output.
  for (let index = 0; index < results.length; index += 1) {
    await writeFile(join(TERRAIN_REPOSITORY, 'public', 'models', TERRAIN_SOURCES[index].file), results[index].bytes);
  }
  await writeFile(join(TERRAIN_REPOSITORY, 'src', 'lib', 'scene', 'terrainRim.ts'),
    `// Generated by bun run bake:island; edit terrainOutline.ts, not these decoded profiles.\n` +
    `import type { TerrainRimPoint } from './terrainSkirt';\n\n${profile}`);
  await writeFile(join(TERRAIN_REPOSITORY, 'src', 'lib', 'scene', 'terrain-outline-bake.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(TERRAIN_REPOSITORY, 'public', 'images', 'shore-field.png'), png);
  console.log(JSON.stringify(manifest, null, 2));
}

export async function rebakeShoreField(): Promise<void> {
  const io = await createTerrainIO();
  const { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } = await import('./terrainRim');
  const manifest = (await import('./terrain-outline-bake.json')).default;
  if (manifest.version !== TERRAIN_OUTLINE_VERSION || manifest.sourceRef !== TERRAIN_SOURCE_REF ||
      manifest.variants.length !== TERRAIN_SOURCES.length) {
    throw new Error('Terrain bake manifest is stale. Run "bun run bake:island" to regenerate the whole asset set.');
  }
  const rims = [TERRAIN_RIM, TERRAIN_SOFTWARE_RIM];
  const surfaces = [];
  for (let index = 0; index < TERRAIN_SOURCES.length; index += 1) {
    const bytes = await readFile(join(TERRAIN_REPOSITORY, 'public', 'models', TERRAIN_SOURCES[index].file));
    const expected = manifest.variants[index];
    if (sha256(bytes) !== expected.sha256 ||
        sha256(Buffer.from(JSON.stringify(rims[index]))) !== expected.rimSha256) {
      throw new Error('Terrain geometry and rim profile do not match their bake. Run "bun run bake:island" before rebaking surf.');
    }
    const document = await io.readBinary(bytes);
    const extras = document.getRoot().getExtras();
    if (!extras.terrainOutline) throw new Error('Terrain has not been shaped. Run "bun run bake:island" first.');
    surfaces.push([...terrainRecords(document), surfaceFromSkirt(rims[index]), surfaceFromContinuation(rims[index])]);
  }
  const pixels = bakeShorePixels(surfaces[0]);
  const registration = surfaces.map(surface => verifyShoreRegistration(pixels, surface, [surface[surface.length - 1]]));
  const png = encodeShorePng(pixels);
  const manifestPath = join(TERRAIN_REPOSITORY, 'src', 'lib', 'scene', 'terrain-outline-bake.json');
  manifest.shore = { ...SHORE_BAKE_LAYOUT, origin: [...SHORE_BAKE_LAYOUT.origin], bytes: png.length, sha256: sha256(png) };
  manifest.variants.forEach((variant: { maximumShoreError: number }, index: number) => {
    variant.maximumShoreError = registration[index];
  });
  await writeFile(join(TERRAIN_REPOSITORY, 'public', 'images', 'shore-field.png'), png);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ shore: manifest.shore, maximumShoreError: registration }));
}
