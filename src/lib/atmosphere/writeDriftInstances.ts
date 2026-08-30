import * as THREE from 'three';
import {
  DEFAULT_DRIFT_BOUNDS,
  MOTE_NEAR_FADE_DISTANCE,
  driftHeight,
  driftSpin,
  driftSwayX,
  driftSwayZ,
  moteNearFadeScale,
  type DriftBounds,
} from './drift';

/**
 * Module-scope scratch. Allocating per instance per frame would churn the GC
 * hundreds of times a frame at production instance counts.
 */
const scratchObject = new THREE.Object3D();

/**
 * Writes every mote's transform for `time` into the instanced mesh.
 *
 * Positions are world-space, so `cameraPosition` can be compared directly and
 * motes approaching the lens can be scaled away.
 */
export function writeDriftInstances(
  mesh: THREE.InstancedMesh,
  seeds: Float32Array,
  count: number,
  time: number,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS,
  cameraPosition?: THREE.Vector3 | null,
  nearFadeDistance: number = MOTE_NEAR_FADE_DISTANCE
): void {
  const [centerX, centerY, centerZ] = bounds.center;

  for (let i = 0; i < count; i++) {
    const x = centerX + driftSwayX(seeds, i, time);
    const y = centerY + driftHeight(seeds, i, time, bounds);
    const z = centerZ + driftSwayZ(seeds, i, time);

    scratchObject.position.set(x, y, z);

    const spin = driftSpin(seeds, i, time);
    scratchObject.rotation.set(spin, spin * 0.7, 0);

    const scale = cameraPosition
      ? moteNearFadeScale(
          Math.hypot(x - cameraPosition.x, y - cameraPosition.y, z - cameraPosition.z),
          nearFadeDistance
        )
      : 1;
    scratchObject.scale.setScalar(scale);

    scratchObject.updateMatrix();
    mesh.setMatrixAt(i, scratchObject.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}
