import * as THREE from 'three';

const corner = new THREE.Vector3();

/**
 * Whether everything `camera` can see lies above the horizontal plane at
 * height `y`. The view frustum is the convex hull of its eight corners, so it
 * is enough that every corner does. Conservative the other way: a frustum that
 * dips below the plane anywhere, even outside the surface's extent, counts as
 * seeing it. Reads the camera's current world and projection matrices.
 */
export function viewClearsPlane(camera: THREE.Camera, y: number): boolean {
  for (let index = 0; index < 8; index++) {
    corner.set(index & 1 ? 1 : -1, index & 2 ? 1 : -1, index & 4 ? 1 : -1).unproject(camera);
    if (!(corner.y > y)) return false;
  }
  return true;
}
