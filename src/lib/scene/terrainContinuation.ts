import * as THREE from 'three';
import type { TerrainRimPoint } from './terrainSkirt';

export const TERRAIN_CONTINUATION_SEGMENTS = 32;
export const TERRAIN_CONTINUATION_RADII = [48, 110, 240] as const;
const TAU = Math.PI * 2;

function angleOf(point: TerrainRimPoint): number {
  return (Math.atan2(point[2] + 20, point[0]) + TAU) % TAU;
}

function heightAt(x: number, z: number): number {
  // Away from the joined headland, the coast settles at Z=-8. This also
  // continues the clamped shore field correctly beyond its existing X limits.
  const rise = THREE.MathUtils.smoothstep(-z, 35, 85);
  return Math.min(9, -4 - (z + 8) * 0.07 +
    rise * (1.3 * Math.sin(x * 0.043 + 0.4) + 0.9 * Math.cos(z * 0.057)));
}

/** Static land, not a skirt: the exact decoded rim opens into a distant mainland. */
export function createTerrainContinuation(rim: readonly TerrainRimPoint[]): THREE.BufferGeometry {
  if (rim.length < 3 || rim.some(point => !point.every(Number.isFinite))) {
    throw new Error('Terrain continuation requires a finite decoded boundary.');
  }
  const angles = rim.map(angleOf);
  if (angles.some((angle, index) => index > 0 && angle <= angles[index - 1]) ||
      rim.some(point => Math.hypot(point[0], point[2] + 20) >= TERRAIN_CONTINUATION_RADII[0])) {
    throw new Error('Terrain continuation requires an ordered rim inside its first land ring.');
  }
  const count = rim.length;
  const segments = TERRAIN_CONTINUATION_SEGMENTS;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [x, y, z, u, v] of rim) {
    positions.push(x, y, z);
    uvs.push(u, v);
  }
  const start = angles[0];
  for (const [ring, radius] of TERRAIN_CONTINUATION_RADII.entries()) {
    for (let station = 0; station < segments; station++) {
      const angle = start + station / segments * TAU;
      const wrapped = angle % TAU;
      let next = angles.findIndex(value => value > wrapped);
      if (next < 0) next = 0;
      const previous = (next + count - 1) % count;
      const span = (angles[next] - angles[previous] + TAU) % TAU;
      const mix = ((wrapped - angles[previous] + TAU) % TAU) / span;
      const x = Math.cos(angle) * radius;
      const z = -20 + Math.sin(angle) * radius;
      positions.push(x, heightAt(x, z), z);
      for (const axis of [3, 4] as const) {
        const edgeUV = THREE.MathUtils.lerp(rim[previous][axis], rim[next][axis], mix);
        uvs.push(THREE.MathUtils.lerp(edgeUV, 0.5, [0.18, 0.35, 0.1][ring]));
      }
    }
  }
  // Zipper the dense authored border to a coarse ring without simplifying the
  // join or drawing triangles across the protected island interior.
  let inner = 0;
  let outer = 0;
  while (inner < count || outer < segments) {
    const nextInner = inner + 1 < count ? angles[inner + 1] : start + TAU;
    const nextOuter = start + (outer + 1) / segments * TAU;
    if (inner < count && (outer === segments || nextInner <= nextOuter)) {
      indices.push(inner % count, (inner + 1) % count, count + outer % segments);
      inner++;
    } else {
      indices.push(inner % count, count + (outer + 1) % segments, count + outer % segments);
      outer++;
    }
  }
  for (let ring = 0; ring < TERRAIN_CONTINUATION_RADII.length - 1; ring++) {
    const from = count + ring * segments;
    const to = from + segments;
    for (let station = 0; station < segments; station++) {
      const next = (station + 1) % segments;
      indices.push(from + station, from + next, to + station, from + next, to + next, to + station);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length).fill(1), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
