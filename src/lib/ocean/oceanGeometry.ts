import * as THREE from 'three';

/**
 * The surface the swell is displaced on.
 *
 * A flat plane cannot carry waves: the ocean shipped as two triangles, which
 * is all a normal map needs but leaves nothing to move. Waves need vertices,
 * and vertices are the one thing this page has no budget for -- subdividing a
 * 1400-unit plane finely enough to break surf on the coast would cost more
 * triangles than the entire rest of the scene.
 *
 * So the grid is polar and centred on the island, and its rings are packed
 * toward the coast. The surf zone -- the first sixty units out, where waves
 * shoal, steepen and break -- gets most of the vertices; the open water beyond
 * gets a handful of huge rings, which is all it needs, because out there the
 * normal map is doing the work and the horizon is a couple of pixels tall.
 *
 * The result carries a detailed shoreline for roughly a tenth of the triangles
 * a uniform grid of the same shoreline density would need.
 */

export interface OceanGeometryOptions {
  /** Segments around the island. Sets the resolution along the coast. */
  radialSegments: number;
  /** Rings from the centre outward. Sets the resolution across the surf. */
  rings: number;
  /** How far the water reaches. Should cover the view to the horizon. */
  outerRadius: number;
  /**
   * Where the rings stop being packed, in world units from the centre.
   *
   * Rings are distributed evenly out to here and stretched beyond it, so this
   * is effectively the width of the detailed band around the island.
   */
  detailRadius: number;
  /**
   * Share of the rings spent inside `detailRadius`.
   *
   * The remainder covers everything out to `outerRadius`, which is a far
   * greater area but needs far less of it.
   */
  detailShare: number;
}

export const DEFAULT_OCEAN_GEOMETRY: OceanGeometryOptions = {
  radialSegments: 160,
  rings: 88,
  outerRadius: 700,
  detailRadius: 70,
  detailShare: 0.72,
};

/**
 * Radius of ring `index` of `rings`, in world units.
 *
 * Linear inside the detail band so the surf is sampled evenly across its
 * width, then quadratic outside it so the open water is covered without the
 * rings jumping in size at the seam.
 */
export function ringRadius(
  index: number,
  { rings, outerRadius, detailRadius, detailShare }: OceanGeometryOptions
): number {
  if (rings <= 0) return 0;

  const t = Math.min(Math.max(index / rings, 0), 1);
  if (detailShare <= 0) return outerRadius * t;
  if (detailShare >= 1) return detailRadius * t;

  if (t <= detailShare) return detailRadius * (t / detailShare);

  const beyond = (t - detailShare) / (1 - detailShare);
  return detailRadius + (outerRadius - detailRadius) * beyond * beyond;
}

/**
 * Builds the disc, in the local space of a plane that will be laid flat.
 *
 * The mesh is rotated -90 degrees about X to become the ocean surface, which
 * maps local (x, y) onto world (x, -z). `centre` is therefore given in that
 * local space: for an island at world z of -20, pass a local y of 20.
 */
export function createOceanGeometry(
  centre: readonly [number, number] = [0, 0],
  options: OceanGeometryOptions = DEFAULT_OCEAN_GEOMETRY
): THREE.BufferGeometry {
  const { radialSegments, rings } = options;

  if (radialSegments < 3 || rings < 1) {
    throw new Error('An ocean needs at least three segments and one ring.');
  }

  const vertexCount = radialSegments * (rings + 1) + 1;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  // The pole. A polar grid has one vertex at the centre, shared by the whole
  // innermost fan -- which sits under the island, where nothing is visible.
  positions[0] = centre[0];
  positions[1] = centre[1];
  positions[2] = 0;
  normals[2] = 1;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  const uvScale = 1 / (options.outerRadius * 2);

  for (let ring = 0; ring <= rings; ring += 1) {
    const radius = ringRadius(ring + 1, options);

    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const index = 1 + ring * radialSegments + segment;

      const x = centre[0] + Math.cos(angle) * radius;
      const y = centre[1] + Math.sin(angle) * radius;

      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = 0;

      normals[index * 3 + 2] = 1;

      // Carried through only so anything sampling the surface by UV keeps
      // working; the shader itself reads world position, not UV.
      uvs[index * 2] = x * uvScale + 0.5;
      uvs[index * 2 + 1] = y * uvScale + 0.5;
    }
  }

  const indices: number[] = [];

  // Innermost fan, from the pole out to the first ring.
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(0, 1 + segment, 1 + next);
  }

  for (let ring = 0; ring < rings; ring += 1) {
    const inner = 1 + ring * radialSegments;
    const outer = inner + radialSegments;

    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      indices.push(inner + segment, outer + segment, outer + next);
      indices.push(inner + segment, outer + next, inner + next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  // The waves move vertices well outside the flat disc, and a surface culled
  // on its undisplaced bounds pops out of view as the camera comes down to it.
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius *= 1.1;

  return geometry;
}
