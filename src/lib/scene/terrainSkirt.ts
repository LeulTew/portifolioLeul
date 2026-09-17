import * as THREE from 'three';

export type TerrainRimPoint = readonly [x: number, y: number, z: number, u: number, v: number];
export const TERRAIN_SKIRT_BOTTOM = -8.2;

/** The top follows the final decoded border exactly, including its original UVs. */
export function createTerrainSkirtFromRim(rim: readonly TerrainRimPoint[]): THREE.BufferGeometry {
  if (rim.length < 3 || rim.some(point => !point.every(Number.isFinite))) {
    throw new Error('Terrain skirt requires a finite, closed boundary profile.');
  }
  const count = rim.length;
  const positions = new Float32Array(count * 2 * 3);
  const colors = new Float32Array(positions.length);
  const uvs = new Float32Array(count * 2 * 2);
  const indices: number[] = [];
  rim.forEach(([x, y, z, u, v], index) => {
    const radius = Math.hypot(x, z + 20);
    if (radius < 1) throw new Error('Terrain boundary crosses the island interior.');
    const angle = Math.atan2(z + 20, x);
    const foot = 1.25 + 0.45 * Math.sin(3 * angle + 0.5);
    positions.set([x, y, z], index * 3);
    positions.set([
      x + x / radius * foot,
      Math.min(TERRAIN_SKIRT_BOTTOM, y - 0.75),
      z + (z + 20) / radius * foot,
    ], (count + index) * 3);
    colors.set([1, 1, 1], index * 3);
    colors.set([0.3, 0.3, 0.3], (count + index) * 3);
    uvs.set([u, v], index * 2);
    uvs.set([u, v], (count + index) * 2);
  });
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    // Keep the join below the local wash/trough, not just below the mean plane.
    if (Math.max(rim[index][1], rim[next][1]) < -5.1) continue;
    indices.push(index, next, count + index, next, count + next, count + index);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
