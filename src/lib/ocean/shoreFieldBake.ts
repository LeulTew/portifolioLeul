import type { TerrainPoint } from '../scene/terrainOutline';

export interface ShoreBakeLayout {
  readonly resolution: number;
  readonly extent: number;
  readonly origin: readonly [number, number];
  readonly range: number;
  readonly waterline: number;
}

export const SHORE_BAKE_LAYOUT: ShoreBakeLayout = {
  resolution: 512,
  extent: 180,
  origin: [-90, -110],
  range: 48,
  waterline: -4,
};

export interface ShoreMesh {
  readonly positions: Float64Array;
  readonly indices: ArrayLike<number> | null;
}

export type ShoreSegment = readonly [
  a: readonly [x: number, z: number], b: readonly [x: number, z: number],
];

export function visitShoreTriangles(
  meshes: readonly ShoreMesh[],
  visit: (a: TerrainPoint, b: TerrainPoint, c: TerrainPoint) => void,
): void {
  const points: [number, number, number][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const mesh of meshes) {
    const count = mesh.indices?.length ?? mesh.positions.length / 3;
    if (count % 3 !== 0) throw new Error('Shore bake requires complete triangles.');
    for (let triangle = 0; triangle < count; triangle += 3) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = (mesh.indices?.[triangle + corner] ?? triangle + corner) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          points[corner][axis] = mesh.positions[vertex + axis];
        }
      }
      visit(points[0], points[1], points[2]);
    }
  }
}

/** Project only the portions of the final terrain AND skirt above the water. */
export function rasterizeShore(
  meshes: readonly ShoreMesh[], layout: ShoreBakeLayout = SHORE_BAKE_LAYOUT,
): Uint8Array {
  const { resolution, extent, origin, waterline } = layout;
  const mask = new Uint8Array(resolution * resolution);
  const texel = extent / resolution;
  visitShoreTriangles(meshes, (a, b, c) => {
    if (Math.max(a[1], b[1], c[1]) < waterline) return;
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-12) return;
    const firstX = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - origin[0]) / texel - 0.5));
    const lastX = Math.min(resolution - 1, Math.floor((Math.max(a[0], b[0], c[0]) - origin[0]) / texel - 0.5));
    const firstZ = Math.max(0, Math.ceil((Math.min(a[2], b[2], c[2]) - origin[1]) / texel - 0.5));
    const lastZ = Math.min(resolution - 1, Math.floor((Math.max(a[2], b[2], c[2]) - origin[1]) / texel - 0.5));
    for (let row = firstZ; row <= lastZ; row += 1) {
      const z = origin[1] + (row + 0.5) * texel;
      for (let column = firstX; column <= lastX; column += 1) {
        const x = origin[0] + (column + 0.5) * texel;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
        const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
        const w = 1 - u - v;
        if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9 &&
            u * a[1] + v * b[1] + w * c[1] >= waterline) {
          mask[row * resolution + column] = 1;
        }
      }
    }
  });
  return mask;
}

/** Squared Euclidean distance transform, linear in the number of texels. */
function distanceTo(mask: Uint8Array, feature: number, size: number): Float64Array {
  const scratch = new Float64Array(mask.length);
  const result = new Float64Array(mask.length);
  const values = new Float64Array(size);
  const output = new Float64Array(size);
  const sites = new Int32Array(size);
  const cuts = new Float64Array(size + 1);
  const transform = () => {
    let last = 0;
    sites[0] = 0;
    cuts[0] = -Infinity;
    cuts[1] = Infinity;
    for (let q = 1; q < size; q += 1) {
      let p = sites[last];
      let cut = ((values[q] + q * q) - (values[p] + p * p)) / (2 * (q - p));
      while (cut <= cuts[last]) {
        last -= 1;
        p = sites[last];
        cut = ((values[q] + q * q) - (values[p] + p * p)) / (2 * (q - p));
      }
      last += 1;
      sites[last] = q;
      cuts[last] = cut;
      cuts[last + 1] = Infinity;
    }
    last = 0;
    for (let q = 0; q < size; q += 1) {
      while (cuts[last + 1] < q) last += 1;
      output[q] = (q - sites[last]) ** 2 + values[sites[last]];
    }
  };
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      values[column] = mask[row * size + column] === feature ? 0 : 1e12;
    }
    transform();
    scratch.set(output, row * size);
  }
  for (let column = 0; column < size; column += 1) {
    for (let row = 0; row < size; row += 1) values[row] = scratch[row * size + column];
    transform();
    for (let row = 0; row < size; row += 1) result[row * size + column] = output[row];
  }
  return result;
}

export function bakeShorePixels(
  meshes: readonly ShoreMesh[], layout: ShoreBakeLayout = SHORE_BAKE_LAYOUT,
): Uint8Array {
  if (!Number.isInteger(layout.resolution) || layout.resolution < 2 ||
      layout.extent <= 0 || layout.range <= 0) {
    throw new Error('Invalid shore field layout.');
  }
  const mask = rasterizeShore(meshes, layout);
  if (!mask.includes(1) || !mask.includes(0)) throw new Error('Shore field must contain land and sea.');
  const inland = distanceTo(mask, 0, layout.resolution);
  const seaward = distanceTo(mask, 1, layout.resolution);
  const texel = layout.extent / layout.resolution;
  return mask.map((land, index) => {
    const distance = (Math.sqrt(land ? inland[index] : seaward[index]) - 0.5) * texel * (land ? -1 : 1);
    return Math.round(Math.max(0, Math.min(1, 0.5 + distance / (2 * layout.range))) * 255);
  });
}

export function sliceShore(
  meshes: readonly ShoreMesh[], waterline = SHORE_BAKE_LAYOUT.waterline,
): ShoreSegment[] {
  const segments: ShoreSegment[] = [];
  visitShoreTriangles(meshes, (a, b, c) => {
    const crossings: [number, number][] = [];
    const points = [a, b, c];
    for (let edge = 0; edge < 3; edge += 1) {
      const from = points[edge];
      const to = points[(edge + 1) % 3];
      if ((from[1] < waterline) === (to[1] < waterline)) continue;
      const t = (waterline - from[1]) / (to[1] - from[1]);
      crossings.push([from[0] + t * (to[0] - from[0]), from[2] + t * (to[2] - from[2])]);
    }
    if (crossings.length === 2 &&
        Math.hypot(crossings[0][0] - crossings[1][0], crossings[0][1] - crossings[1][1]) > 1e-7) {
      segments.push([crossings[0], crossings[1]]);
    }
  });
  return segments;
}

/** A buried skirt waterline is no longer a coast after adjoining land is added. */
export function isShoreCovered(
  coveringMeshes: readonly ShoreMesh[], x: number, z: number,
  waterline = SHORE_BAKE_LAYOUT.waterline,
): boolean {
  let covered = false;
  visitShoreTriangles(coveringMeshes, (a, b, c) => {
    if (covered || x < Math.min(a[0], b[0], c[0]) || x > Math.max(a[0], b[0], c[0]) ||
        z < Math.min(a[2], b[2], c[2]) || z > Math.max(a[2], b[2], c[2])) return;
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-12) return;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    const w = 1 - u - v;
    covered = u >= -1e-9 && v >= -1e-9 && w >= -1e-9 &&
      u * a[1] + v * b[1] + w * c[1] > waterline + 0.0001;
  });
  return covered;
}

/** Matches LinearFilter + ClampToEdgeWrapping + flipY=false in the water. */
export function sampleShorePixels(
  pixels: Uint8Array, x: number, z: number, layout: ShoreBakeLayout = SHORE_BAKE_LAYOUT,
): number {
  const { resolution, extent, origin, range } = layout;
  const u = Math.max(0, Math.min(resolution - 1, (x - origin[0]) / extent * resolution - 0.5));
  const v = Math.max(0, Math.min(resolution - 1, (z - origin[1]) / extent * resolution - 0.5));
  const left = Math.floor(u);
  const top = Math.floor(v);
  const right = Math.min(left + 1, resolution - 1);
  const bottom = Math.min(top + 1, resolution - 1);
  const a = pixels[top * resolution + left] * (1 - u + left) + pixels[top * resolution + right] * (u - left);
  const b = pixels[bottom * resolution + left] * (1 - u + left) + pixels[bottom * resolution + right] * (u - left);
  return ((a * (1 - v + top) + b * (v - top)) / 255 - 0.5) * 2 * range;
}
