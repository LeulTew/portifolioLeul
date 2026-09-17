import * as THREE from 'three';
import { OCEAN_SIZE } from '@/components/ocean/oceanConfig';
import { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } from './terrainRim';
import { createTerrainSkirtFromRim } from './terrainSkirt';

export const EDGE_WATER_LEVEL = -4;
export const HORIZON_SEGMENTS = 32;
export const HORIZON_INNER_RADIUS = 320;
export const HORIZON_OUTER_RADIUS = OCEAN_SIZE / 2 + 200;
export const HORIZON_WATER_RADIUS = OCEAN_SIZE / 2;

const ISLAND_Z = -20;
export function createTerrainSkirtGeometry(softwareRenderer = false): THREE.BufferGeometry {
  return createTerrainSkirtFromRim(softwareRenderer ? TERRAIN_SOFTWARE_RIM : TERRAIN_RIM);
}

/**
 * A hole leaves the visible swell/reflections untouched. The shader also
 * rejects anything short of full fog, including extreme-aspect edge rays.
 */
export function createHorizonGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(HORIZON_SEGMENTS * 2 * 3);
  const normals = new Float32Array(positions.length);
  const radii = new Float32Array(HORIZON_SEGMENTS * 2);
  const indices: number[] = [];

  for (let ring = 0; ring < 2; ring += 1) {
    const radius = ring === 0 ? HORIZON_INNER_RADIUS : HORIZON_OUTER_RADIUS;
    for (let index = 0; index < HORIZON_SEGMENTS; index += 1) {
      const angle = index / HORIZON_SEGMENTS * Math.PI * 2;
      const vertex = ring * HORIZON_SEGMENTS + index;
      positions.set([
        Math.cos(angle) * radius,
        EDGE_WATER_LEVEL + 0.02,
        ISLAND_Z + Math.sin(angle) * radius,
      ], vertex * 3);
      normals.set([0, 1, 0], vertex * 3);
      radii[vertex] = radius;
    }
  }

  for (let index = 0; index < HORIZON_SEGMENTS; index += 1) {
    const next = (index + 1) % HORIZON_SEGMENTS;
    const outer = HORIZON_SEGMENTS;
    indices.push(index, next, outer + next, index, outer + next, outer + index);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('horizonRadius', new THREE.BufferAttribute(radii, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function horizonFogWeight(radius: number): number {
  return 1 - THREE.MathUtils.smoothstep(radius, HORIZON_INNER_RADIUS, HORIZON_OUTER_RADIUS);
}
