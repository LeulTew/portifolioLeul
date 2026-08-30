import * as THREE from 'three';
import {
  DEFAULT_DRIFT_BOUNDS,
  driftHeight,
  driftSpin,
  driftSwayX,
  driftSwayZ,
  type DriftBounds,
} from './drift';

/**
 * Module-scope scratch. Allocating per instance per frame would churn the GC
 * hundreds of times a frame at production instance counts.
 */
const scratchObject = new THREE.Object3D();

/** Writes every mote's transform for `time` into the instanced mesh. */
export function writeDriftInstances(
  mesh: THREE.InstancedMesh,
  seeds: Float32Array,
  count: number,
  time: number,
  bounds: DriftBounds = DEFAULT_DRIFT_BOUNDS
): void {
  for (let i = 0; i < count; i++) {
    scratchObject.position.set(
      driftSwayX(seeds, i, time),
      driftHeight(seeds, i, time, bounds),
      driftSwayZ(seeds, i, time)
    );

    const spin = driftSpin(seeds, i, time);
    scratchObject.rotation.set(spin, spin * 0.7, 0);
    scratchObject.updateMatrix();
    mesh.setMatrixAt(i, scratchObject.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
}
