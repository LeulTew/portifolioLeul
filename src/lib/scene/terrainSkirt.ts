import * as THREE from 'three';

export type TerrainRimPoint = readonly [x: number, y: number, z: number, u: number, v: number];
export const TERRAIN_SKIRT_BOTTOM = -8.2;

/** The top follows the final decoded border exactly, including its original UVs. */
export function createTerrainSkirtFromRim(rim: readonly TerrainRimPoint[]): THREE.BufferGeometry {
  if (rim.length < 3 || rim.some(point => !point.every(Number.isFinite))) {
    throw new Error('Terrain skirt requires a finite, closed boundary profile.');
  }
  const count = rim.length;
  const positions = new Float32Array(count * 3 * 3);
  const colors = new Float32Array(positions.length);
  const uvs = new Float32Array(count * 3 * 2);
  const indices: number[] = [];
  rim.forEach(([x, y, z, u, v], index) => {
    const radius = Math.hypot(x, z + 20);
    if (radius < 1) throw new Error('Terrain boundary crosses the island interior.');
    const angle = Math.atan2(z + 20, x);
    const shoulder = 1.65 + 0.7 * Math.sin(3 * angle + 0.5) + 0.25 * Math.sin(7 * angle);
    const foot = 4.5 + 0.9 * Math.sin(3 * angle + 0.5);
    const heights = [
      y,
      Math.min(y - 0.5, (y - 4) / 2 + 0.35 * Math.sin(5 * angle)),
      Math.min(TERRAIN_SKIRT_BOTTOM, y - 0.75),
    ];
    for (let row = 0; row < 3; row += 1) {
      const spread = [0, shoulder, foot][row];
      positions.set([
        x + x / radius * spread,
        heights[row],
        z + (z + 20) / radius * spread,
      ], (row * count + index) * 3);
      const shade = [1, 0.78, 0.45][row];
      colors.set([shade, shade, shade], (row * count + index) * 3);
      const inward = [0, 0.08, 0.16][row];
      uvs.set([u + (0.5 - u) * inward, v + (0.5 - v) * inward], (row * count + index) * 2);
    }
  });
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    // Keep the join below the local wash/trough, not just below the mean plane.
    if (Math.max(rim[index][1], rim[next][1]) < -5.1) continue;
    for (let row = 0; row < 2; row += 1) {
      const upper = row * count;
      const lower = upper + count;
      indices.push(upper + index, upper + next, lower + index, upper + next, lower + next, lower + index);
    }
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
