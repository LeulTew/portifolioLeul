import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createTerrainIO, decodeShorePng, encodeShorePng, measureTerrainRimJoin, readTerrainSource, sha256,
  surfaceFromContinuation, surfaceFromSkirt, terrainRecords, verifyShoreRegistration,
  TERRAIN_REPOSITORY, TERRAIN_SOURCE_REF, TERRAIN_SOURCES,
} from './terrainAssetBake';
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

  it('preserves every protected face and encoded interior position/normal, not just prop origins', () => {
    for (const asset of assets) {
      let protectedFaces = 0;
      let changedProtectedComponents = 0;
      let changedCoreComponents = 0;
      let changedInteriorNormals = 0;
      let checkedNormalFaces = 0;
      const changedUvFaces = new Set<string>();
      asset.before.forEach((before, recordIndex) => {
        const after = asset.after[recordIndex];
        const oldPosition = before.position.getArray()!;
        const newPosition = after.position.getArray()!;
        expect(newPosition.length).toBe(oldPosition.length);
        expect(after.indices).toEqual(before.indices);
        const oldUV = before.uv.getArray()!;
        const newUV = after.uv.getArray()!;
        const sourceUVs = new Set<string>();
        for (let vertex = 0; vertex < before.uv.getCount(); vertex += 1) {
          sourceUVs.add(`${oldUV[vertex * 2]},${oldUV[vertex * 2 + 1]}`);
        }
        for (let vertex = 0; vertex < before.position.getCount(); vertex += 1) {
          const point = pointAt(before.positions, vertex);
          if (oldUV[vertex * 2] !== newUV[vertex * 2] || oldUV[vertex * 2 + 1] !== newUV[vertex * 2 + 1]) {
            expect(sourceUVs.has(`${newUV[vertex * 2]},${newUV[vertex * 2 + 1]}`)).toBe(true);
            expect(Math.hypot(...terrainPlanarPoint(point))).toBeGreaterThan(TERRAIN_CORE_RADIUS);
            changedUvFaces.add(`${recordIndex}:${Math.floor(vertex / 3)}`);
          }
          if (Math.hypot(...terrainPlanarPoint(point)) <= TERRAIN_CORE_RADIUS) {
            for (let axis = 0; axis < 3; axis += 1) {
              if (oldPosition[vertex * 3 + axis] !== newPosition[vertex * 3 + axis]) changedCoreComponents += 1;
            }
          }
        }
        const count = before.indices?.length ?? before.position.getCount();
        for (let triangle = 0; triangle < count; triangle += 3) {
          const vertices = [0, 1, 2].map(corner => before.indices?.[triangle + corner] ?? triangle + corner);
          const points = vertices.map(vertex => pointAt(before.positions, vertex));
          const protectedFace = isProtectedTerrainTriangle(points[0], points[1], points[2]);
          if (protectedFace) {
            protectedFaces += 1;
            for (const vertex of vertices) {
              expect(newUV[vertex * 2]).toBe(oldUV[vertex * 2]);
              expect(newUV[vertex * 2 + 1]).toBe(oldUV[vertex * 2 + 1]);
              for (let axis = 0; axis < 3; axis += 1) {
                if (oldPosition[vertex * 3 + axis] !== newPosition[vertex * 3 + axis]) changedProtectedComponents += 1;
              }
            }
          }
          if (before.normal && (protectedFace ||
              points.every(point => Math.hypot(...terrainPlanarPoint(point)) < TERRAIN_CORE_RADIUS))) {
            checkedNormalFaces += 1;
            const oldNormal = before.normal.getArray()!;
            const newNormal = after.normal!.getArray()!;
            for (const vertex of vertices) {
              for (let axis = 0; axis < 3; axis += 1) {
                if (oldNormal[vertex * 3 + axis] !== newNormal[vertex * 3 + axis]) changedInteriorNormals += 1;
              }
            }
          }
        }
      });
      expect(protectedFaces).toBeGreaterThan(100);
      expect(changedProtectedComponents).toBe(0);
      expect(changedCoreComponents).toBe(0);
      expect(changedInteriorNormals).toBe(0);
      expect(changedUvFaces.size).toBeLessThanOrEqual(bake.variants[asset.source.variant === 'software' ? 1 : 0].retriangulatedFaces);
      if (asset.source.variant === 'optimized') expect(checkedNormalFaces).toBeGreaterThan(100);
      expect(asset.final.getRoot().listTextures().map(texture => sha256(texture.getImage()!)))
        .toEqual(asset.original.getRoot().listTextures().map(texture => sha256(texture.getImage()!)));
    }
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

  it('retains terrain mesh/vertex/triangle counts and adds no terrain draw calls', () => {
    assets.forEach((asset, index) => {
      expect(asset.after).toHaveLength(15);
      expect(asset.after.map(record => record.position.getCount()))
        .toEqual(asset.before.map(record => record.position.getCount()));
      expect(bake.variants[index].triangles).toBe(index ? 75158 : 113858);
      expect(bake.variants[index].skirtTriangles).toBeLessThanOrEqual(4096);
      expect(bake.variants[index].changedVertices).toBeGreaterThan(1000);
      expect(bake.variants[index].unchangedVertices).toBeGreaterThan(bake.variants[index].vertices / 2);
      expect(bake.variants[index].retriangulatedFaces).toBe(index ? 0 : 2);
      expect(bake.variants[index].minimumOrientationCosine).toBeGreaterThan(0.5);
      expect(bake.variants[index].minimumJacobianDeterminant).toBeGreaterThan(0);
    });
  });
});
