import * as THREE from 'three';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';

export const TV_PARALLAX_MAX_OFFSET = 0.13;
const right = new THREE.Vector3(1, 0, 0);
const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, -1);

export class TVParallax {
  private x = 0;
  private y = 0;
  private handoffDistance = 0;
  private offset = new THREE.Vector3();
  private viewRight = new THREE.Vector3();
  private viewUp = new THREE.Vector3();
  private target = new THREE.Vector3();
  private look = new THREE.Matrix4();

  reset(): void {
    this.x = this.y = this.handoffDistance = 0;
    this.offset.set(0, 0, 0);
  }

  apply(
    position: THREE.Vector3, orientation: THREE.Quaternion,
    pointerX: number, pointerY: number, reading: boolean, allowed: boolean,
    approach: number, dt: number,
  ): void {
    if (!allowed) {
      this.reset();
      return;
    }
    if (reading) {
      this.x = THREE.MathUtils.damp(this.x, pointerX, 7, dt);
      this.y = THREE.MathUtils.damp(this.y, pointerY, 7, dt);
      if (Math.abs(this.x - pointerX) < 0.0001) this.x = pointerX;
      if (Math.abs(this.y - pointerY) < 0.0001) this.y = pointerY;
      this.viewRight.copy(right).applyQuaternion(orientation);
      this.viewUp.copy(up).applyQuaternion(orientation);
      this.offset.copy(this.viewRight).multiplyScalar(this.x * TV_PARALLAX_MAX_OFFSET)
        .addScaledVector(this.viewUp, this.y * TV_PARALLAX_MAX_OFFSET * 0.55);
      this.handoffDistance = 0;
    } else {
      this.handoffDistance = Math.min(1, Math.abs(approach - 1) / 0.28);
    }
    const influence = reading ? 1 : 1 - easeInOutCubic(this.handoffDistance);
    if (influence <= 0) {
      this.reset();
      return;
    }
    this.viewUp.copy(up).applyQuaternion(orientation);
    this.target.copy(forward).applyQuaternion(orientation).multiplyScalar(6).add(position);
    position.addScaledVector(this.offset, influence);
    this.look.lookAt(position, this.target, this.viewUp);
    orientation.setFromRotationMatrix(this.look);
  }
}
