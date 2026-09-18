import * as THREE from 'three';
import { createTerrainSkirtFromRim, TERRAIN_SKIRT_BOTTOM, type TerrainRimPoint } from './terrainSkirt';

export const TERRAIN_CONTINUATION_SEGMENTS = 32;
export const TERRAIN_CONTINUATION_RADII = [52, 65, 115, 240] as const;
const TAU = Math.PI * 2;

function angleOf(point: TerrainRimPoint): number {
  return (Math.atan2(point[2] + 20, point[0]) + TAU) % TAU;
}

function rearJoin(angle: number): number {
  return THREE.MathUtils.smoothstep(-Math.sin(angle), 0.55, 0.85);
}

function heightAt(x: number, z: number): number {
  // Away from the joined headland, the coast settles at Z=-28. This also
  // continues the clamped shore field correctly beyond its existing X limits.
  const coastalVariation = (1 - THREE.MathUtils.smoothstep(Math.abs(x), 35, 55)) *
    (8 * Math.sin(x * 0.065 + 0.35) + 4 * Math.sin(x * 0.12));
  const rise = THREE.MathUtils.smoothstep(-z, 85, 135);
  return Math.min(9, -4 - (z + 28 - coastalVariation) * 0.14 +
    rise * (1.3 * Math.sin(x * 0.043 + 0.4) + 0.9 * Math.cos(z * 0.057)));
}

/** Only the rear headland opens into mainland; visible side/front shores stay intact. */
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
  const skirt = createTerrainSkirtFromRim(rim);
  const skirtPosition = skirt.getAttribute('position');
  const skirtUV = skirt.getAttribute('uv');
  for (let index = 0; index < count; index++) {
    // Join the dry rear rim, but start below water at the *existing* skirt foot
    // elsewhere. A top-rim annulus here would fill visible sea with flat slabs.
    const level = (1 - rearJoin(angles[index])) * 2;
    const upper = Math.floor(level) * count + index;
    const lower = Math.min(Math.floor(level) + 1, 2) * count + index;
    const blend = level % 1;
    for (let axis = 0; axis < 3; axis++) {
      positions.push(THREE.MathUtils.lerp(
        skirtPosition.array[upper * 3 + axis], skirtPosition.array[lower * 3 + axis], blend,
      ));
    }
    uvs.push(
      THREE.MathUtils.lerp(skirtUV.getX(upper), skirtUV.getX(lower), blend),
      THREE.MathUtils.lerp(skirtUV.getY(upper), skirtUV.getY(lower), blend),
    );
  }
  skirt.dispose();
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
      const spread = radius + (ring < 2 ? (ring ? 3 : 2) * Math.sin(5 * angle + ring * 0.6) : 0);
      const x = Math.cos(angle) * spread;
      const z = -20 + Math.sin(angle) * spread;
      const edgeHeight = THREE.MathUtils.lerp(rim[previous][1], rim[next][1], mix);
      const shoulderHeight = edgeHeight + (edgeHeight < -4 ? -0.5 :
        0.7 * Math.sin(5 * angle + 0.4) + 0.5 * Math.sin(11 * angle));
      positions.push(x, ring === 0
        ? THREE.MathUtils.lerp(TERRAIN_SKIRT_BOTTOM, shoulderHeight, rearJoin(angle))
        : heightAt(x, z), z);
      for (const axis of [3, 4] as const) {
        const edgeUV = THREE.MathUtils.lerp(rim[previous][axis], rim[next][axis], mix);
        uvs.push(THREE.MathUtils.lerp(edgeUV, 0.5, [0.12, 0.28, 0.35, 0.1][ring]));
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
