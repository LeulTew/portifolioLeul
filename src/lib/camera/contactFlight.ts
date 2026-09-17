import * as THREE from 'three';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';
import { TV_SCREEN_CENTER, TV_SCREEN_ORIENTATION } from '@/lib/projects/tvScreen';

export const CONTACT_FLIGHT_MS = 2000;
export const CONTACT_REVEAL_START = 0.66;
export const CONTACT_REVEAL_END = 0.92;

export function contactReveal(progress: number): number {
  return easeInOutCubic(Math.min(1, Math.max(0,
    (progress - CONTACT_REVEAL_START) / (CONTACT_REVEAL_END - CONTACT_REVEAL_START),
  )));
}

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(TV_SCREEN_ORIENTATION);
forward.y = 0;
forward.normalize();

export const CONTACT_SKY_POSITION = TV_SCREEN_CENTER.clone().addScaledVector(forward, -7);
CONTACT_SKY_POSITION.y += 17;
const skyTarget = CONTACT_SKY_POSITION.clone().addScaledVector(forward, 30).addScaledVector(up, 18);
export const CONTACT_SKY_ORIENTATION = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(CONTACT_SKY_POSITION, skyTarget, up),
);

/** One path, parameterized TV (0) -> clearing (1), sampled in either direction. */
export class ContactFlight {
  private tvPosition = new THREE.Vector3();
  private tvOrientation = new THREE.Quaternion();
  private skyPosition = CONTACT_SKY_POSITION.clone();
  private skyOrientation = CONTACT_SKY_ORIENTATION.clone();
  private nearControl = new THREE.Vector3();
  private farControl = new THREE.Vector3();
  private back = new THREE.Vector3();
  hasDeparture = false;

  reset(): void {
    this.hasDeparture = false;
  }

  depart(position: THREE.Vector3, orientation: THREE.Quaternion): void {
    this.tvPosition.copy(position);
    this.tvOrientation.copy(orientation);
    this.skyPosition.copy(CONTACT_SKY_POSITION);
    this.skyOrientation.copy(CONTACT_SKY_ORIENTATION);
    this.controls();
    this.hasDeparture = true;
  }

  return(
    position: THREE.Vector3, orientation: THREE.Quaternion,
    tvPosition: THREE.Vector3, tvOrientation: THREE.Quaternion,
  ): void {
    this.skyPosition.copy(position);
    this.skyOrientation.copy(orientation);
    this.tvPosition.copy(tvPosition);
    this.tvOrientation.copy(tvOrientation);
    this.controls();
  }

  private controls(): void {
    this.back.set(0, 0, 1).applyQuaternion(this.tvOrientation);
    this.nearControl.copy(this.tvPosition).addScaledVector(this.back, 2.5).addScaledVector(up, 3);
    this.farControl.copy(this.skyPosition).addScaledVector(forward, -5).addScaledVector(up, -4);
  }

  sample(progress: number, position: THREE.Vector3, orientation: THREE.Quaternion): void {
    if (!Number.isFinite(progress)) throw new RangeError('Contact flight progress must be finite.');
    const t = easeInOutCubic(Math.min(1, Math.max(0, progress)));
    const remaining = 1 - t;
    position.copy(this.tvPosition).multiplyScalar(remaining ** 3)
      .addScaledVector(this.nearControl, 3 * remaining * remaining * t)
      .addScaledVector(this.farControl, 3 * remaining * t * t)
      .addScaledVector(this.skyPosition, t ** 3);
    orientation.copy(this.tvOrientation).slerp(this.skyOrientation, t);
  }
}
