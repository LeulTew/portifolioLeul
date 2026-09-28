import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  cornerKey, createTerrainIO, decodeShorePng, encodeShorePng, faceCensus, faceKeys, leastRotation, measureTerrainRimJoin, readTerrainSource, sha256,
  surfaceFromContinuation, surfaceFromSkirt, terrainRecords, verifyShoreRegistration,
  TERRAIN_REPOSITORY, TERRAIN_SOURCE_REF, TERRAIN_SOURCES,
} from './terrainAssetBake';
import * as THREE from 'three';
import {
  isProtectedTerrainTriangle, terrainPlanarPoint,
  TERRAIN_CORE_RADIUS, type TerrainPoint,
} from './terrainOutline';
import { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } from './terrainRim';
import type { TerrainRimPoint } from './terrainSkirt';
import bake from './terrain-outline-bake.json';
import { bakeShorePixels, isShoreCovered, sampleShorePixels, sliceShore, SHORE_BAKE_LAYOUT } from '../ocean/shoreFieldBake';

async function loadAssets() {
  const io = await createTerrainIO();
  const assets = [];
  for (const source of TERRAIN_SOURCES) {
    const original = await io.readBinary(readTerrainSource(source));
    const bytes = await readFile(join(TERRAIN_REPOSITORY, 'public', 'models', source.file));
    const final = await io.readBinary(bytes);
    assets.push({ source, bytes, original, final, before: terrainRecords(original), after: terrainRecords(final) });
  }
  return assets;
}

function pointAt(positions: Float64Array, index: number): TerrainPoint {
  return [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
}

function longAxisCut(rim: readonly TerrainRimPoint[]): number {
  let longest = 0;
  for (const axis of [0, 2] as const) {
    const across = axis === 0 ? 2 : 0;
    for (let start = 0; start < rim.length; start += 1) {
      let minimum = Infinity;
      let maximum = -Infinity;
      let low = Infinity;
      let high = -Infinity;
      for (let step = 0; step < rim.length / 2; step += 1) {
        const point = rim[(start + step) % rim.length];
        if (point[1] < -5.1 || (point[0] > -22 && point[2] > -29)) break;
        minimum = Math.min(minimum, point[axis]);
        maximum = Math.max(maximum, point[axis]);
        if (maximum - minimum > 0.15) break;
        low = Math.min(low, point[across]);
        high = Math.max(high, point[across]);
        longest = Math.max(longest, high - low);
      }
    }
  }
  return longest;
}

describe('committed organic terrain assets', () => {
  let assets: Awaited<ReturnType<typeof loadAssets>>;
  let png: Uint8Array;
  let pixels: Uint8Array;
  beforeAll(async () => {
    assets = await loadAssets();
    png = await readFile(join(TERRAIN_REPOSITORY, 'public', 'images', 'shore-field.png'));
    pixels = decodeShorePng(png);
  }, 60_000);

  it('ships the exact fingerprinted variants and shore field from the reproducible bake', () => {
    expect(bake.sourceRef).toBe(TERRAIN_SOURCE_REF);
    expect(bake.variants).toHaveLength(2);
    assets.forEach((asset, index) => {
      expect(asset.final.getRoot().getExtras().terrainOutline).toMatchObject({
        sourceRef: TERRAIN_SOURCE_REF, sourceSha256: asset.source.sha256, version: bake.version,
      });
      expect(sha256(asset.bytes)).toBe(bake.variants[index].sha256);
      expect(asset.bytes.length).toBe(bake.variants[index].bytes);
      const rim = index ? TERRAIN_SOFTWARE_RIM : TERRAIN_RIM;
      expect(sha256(Buffer.from(JSON.stringify(rim)))).toBe(bake.variants[index].rimSha256);
    });
    expect(sha256(png)).toBe(bake.shore.sha256);
    expect(png.length).toBe(bake.shore.bytes);
    // Node/Vitest and Bun use different zlib builds; decoded data must be exact.
    expect(decodeShorePng(encodeShorePng(pixels))).toEqual(pixels);
  });

  it('preserves every protected face and interior corner, not just prop origins', () => {
    // Compared by face, not by vertex index: the optimized terrain ships welded and
    // reordered, the same faces over fewer shared vertices (round 31).
    for (const asset of assets) {
      let protectedFaces = 0;
      let missingProtectedFaces = 0;
      let coreCorners = 0;
      let missingCoreCorners = 0;
      let foreignUvCorners = 0;
      let changedUvFaces = 0;
      asset.before.forEach((before, recordIndex) => {
        const after = asset.after[recordIndex];
        const finalFaces = faceCensus(after);
        const finalKeys = faceKeys(after);
        const finalCorners = new Set(finalKeys.flatMap(key => key.split(';')));
        const uvOf = (corner: string) => corner.slice(corner.indexOf('/') + 1);
        const uvFace = (key: string) => leastRotation(key.split(';').map(uvOf));
        const sourceKeys = faceKeys(before);
        const sourceUvs = new Set(sourceKeys.flatMap(key => key.split(';').map(uvOf)));
        const sourceUvFaces = new Set(sourceKeys.map(uvFace));
        for (let vertex = 0; vertex < before.position.getCount(); vertex += 1) {
          if (Math.hypot(...terrainPlanarPoint(pointAt(before.positions, vertex))) > TERRAIN_CORE_RADIUS) continue;
          coreCorners += 1;
          if (!finalCorners.has(cornerKey(before, vertex))) missingCoreCorners += 1;
        }
        const count = before.indices?.length ?? before.position.getCount();
        for (let triangle = 0; triangle < count; triangle += 3) {
          const points = [0, 1, 2].map(corner => pointAt(before.positions, before.indices?.[triangle + corner] ?? triangle + corner));
          if (!isProtectedTerrainTriangle(points[0], points[1], points[2])) continue;
          protectedFaces += 1;
          if (!finalFaces.has(sourceKeys[triangle / 3])) missingProtectedFaces += 1;
        }
        for (const key of finalKeys) {
          for (const corner of key.split(';')) if (!sourceUvs.has(uvOf(corner))) foreignUvCorners += 1;
          if (!sourceUvFaces.has(uvFace(key))) changedUvFaces += 1;
        }
      });
      expect(protectedFaces).toBeGreaterThan(100);
      expect(missingProtectedFaces).toBe(0);
      expect(coreCorners).toBeGreaterThan(1000);
      expect(missingCoreCorners).toBe(0);
      expect(foreignUvCorners).toBe(0);
      expect(changedUvFaces).toBeLessThanOrEqual(bake.variants[asset.source.variant === 'software' ? 1 : 0].retriangulatedFaces);
      expect(asset.final.getRoot().listTextures().map(texture => sha256(texture.getImage()!)))
        .toEqual(asset.original.getRoot().listTextures().map(texture => sha256(texture.getImage()!)));
    }
  });

  it('ships no normal stream: every face is shaded by its own plane, as its source normals were', () => {
    // The optimized source repeats one normal on each face's three corners; flat shading
    // reproduces it from the face itself, so the stream was dropped and the corners welded.
    for (const asset of assets) expect(asset.after.every(record => !record.normal)).toBe(true);
    const optimized = assets.find(asset => asset.source.variant === 'optimized')!;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const stored = new THREE.Vector3();
    const angles: number[] = [];
    let splitFaces = 0;
    for (const record of optimized.before) {
      const normals = record.normal!;
      const matrix = new THREE.Matrix3().getNormalMatrix(record.world);
      for (let vertex = 0; vertex < record.position.getCount(); vertex += 3) {
        const face = [0, 1, 2].map(corner => normals.getElement(vertex + corner, []).join(','));
        if (face[1] !== face[0] || face[2] !== face[0]) splitFaces += 1;
        a.fromArray(pointAt(record.positions, vertex));
        b.fromArray(pointAt(record.positions, vertex + 1)).sub(a);
        c.fromArray(pointAt(record.positions, vertex + 2)).sub(a);
        b.cross(c);
        // A zero-area face draws nothing, however it is shaded.
        if (b.lengthSq() === 0) continue;
        stored.fromArray(normals.getElement(vertex, [])).applyMatrix3(matrix);
        angles.push(THREE.MathUtils.radToDeg(b.angleTo(stored)));
      }
    }
    angles.sort((x, y) => x - y);
    expect(splitFaces).toBe(0);
    expect(angles.length).toBeGreaterThan(80_000);
    expect(angles[Math.floor(angles.length * 0.5)]).toBeLessThan(0.5);
    expect(angles[Math.floor(angles.length * 0.99)]).toBeLessThan(5);
  });

  it('removes long axis-aligned rear/left/rear-right cuts in both actual asset profiles', () => {
    for (const rim of [TERRAIN_RIM, TERRAIN_SOFTWARE_RIM]) {
      expect(longAxisCut(rim)).toBeLessThan(7.5);
      const radii = rim.map(point => Math.hypot(...terrainPlanarPoint([point[0], point[1], point[2]])));
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(6);
      // The old rear/left square corner was [-30, *, -49.4].
      expect(rim.some(point => point[0] < -27 && point[2] < -46)).toBe(false);
      expect(rim.some(point => point[0] > 27 && point[2] < -46)).toBe(false);
    }
  });

  it('places surf on the final exposed waterline including the adjoining mainland', () => {
    assets.forEach((asset, index) => {
      const rim = index ? TERRAIN_SOFTWARE_RIM : TERRAIN_RIM;
      const land = surfaceFromContinuation(rim);
      const error = verifyShoreRegistration(pixels, [...asset.after, surfaceFromSkirt(rim), land], [land]);
      expect(error).toBeLessThanOrEqual(0.8);
      expect(error).toBeCloseTo(bake.variants[index].maximumShoreError, 4);
      // Registration still covers distant shoreline samples outside the field,
      // via the unchanged ClampToEdge sampler, not a looser acceptance mask.
      const remote = sliceShore([land]).flat().filter(([x]) => Math.abs(x) > 90);
      expect(remote.length).toBeGreaterThan(2);
      for (const [x, z] of remote) {
        expect(z).toBeCloseTo(-28, 4);
        expect(Math.abs(sampleShorePixels(pixels, x, z))).toBeLessThan(0.8);
      }
    });
    expect(SHORE_BAKE_LAYOUT).toEqual({
      resolution: 512, extent: 180, origin: [-90, -110], range: 48, waterline: -4,
    });
    const rim = TERRAIN_RIM;
    const land = surfaceFromContinuation(rim);
    expect(pixels).toEqual(bakeShorePixels([...assets[0].after, surfaceFromSkirt(rim), land]));
    let buried = 0;
    for (const [a, b] of sliceShore([surfaceFromSkirt(rim)])) {
      const x = (a[0] + b[0]) / 2;
      const z = (a[1] + b[1]) / 2;
      if (isShoreCovered([land], x, z) && sampleShorePixels(pixels, x, z) < -1) buried++;
    }
    expect(buried).toBeGreaterThan(50);
  });

  it('closes the whole decoded top boundary, including joins between source mesh patches', () => {
    assets.forEach((asset, index) => {
      const rim = index ? TERRAIN_SOFTWARE_RIM : TERRAIN_RIM;
      expect(measureTerrainRimJoin(asset.after, rim)).toBeLessThanOrEqual(0.025);
    });
  });

  it('retains terrain mesh/triangle counts, welds only the optimized corners and adds no terrain draw calls', () => {
    const faces = (records: typeof assets[number]['after']) =>
      records.map(record => (record.indices?.length ?? record.position.getCount()) / 3);
    const vertices = (records: typeof assets[number]['after']) =>
      records.reduce((sum, record) => sum + record.position.getCount(), 0);
    assets.forEach((asset, index) => {
      expect(asset.after).toHaveLength(15);
      expect(faces(asset.after)).toEqual(faces(asset.before));
      expect(vertices(asset.after)).toBe(bake.variants[index].deliveredVertices);
      expect(bake.variants[index].triangles).toBe(index ? 75158 : 113858);
      expect(bake.variants[index].skirtTriangles).toBeLessThanOrEqual(4096);
      expect(bake.variants[index].changedVertices).toBeGreaterThan(1000);
      expect(bake.variants[index].unchangedVertices).toBeGreaterThan(bake.variants[index].vertices / 2);
      expect(bake.variants[index].retriangulatedFaces).toBe(index ? 0 : 2);
      expect(bake.variants[index].minimumOrientationCosine).toBeGreaterThan(0.5);
      expect(bake.variants[index].minimumJacobianDeterminant).toBeGreaterThan(0);
    });
    // The software terrain was indexed already; the optimized one shares its corners now.
    expect(vertices(assets[1].after)).toBe(vertices(assets[1].before));
    expect(bake.variants[0].deliveredVertices).toBeLessThan(bake.variants[0].vertices / 4);
    expect(assets[0].after.every(record => record.indices)).toBe(true);
  });
});

describe('the pristine terrain source', () => {
  it('can be read from another checkout, and says how when it cannot be read at all', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const previous = process.env.TERRAIN_SOURCE_REPOSITORY;
    const empty = mkdtempSync(join(tmpdir(), 'no-history-'));
    try {
      process.env.TERRAIN_SOURCE_REPOSITORY = TERRAIN_REPOSITORY;
      expect(sha256(readTerrainSource(TERRAIN_SOURCES[0]))).toBe(TERRAIN_SOURCES[0].sha256);
      process.env.TERRAIN_SOURCE_REPOSITORY = empty;
      expect(() => readTerrainSource(TERRAIN_SOURCES[0])).toThrow(/TERRAIN_SOURCE_REPOSITORY/);
    } finally {
      if (previous === undefined) delete process.env.TERRAIN_SOURCE_REPOSITORY;
      else process.env.TERRAIN_SOURCE_REPOSITORY = previous;
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
