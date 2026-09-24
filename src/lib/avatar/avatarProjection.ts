import * as THREE from 'three';
import { isIslandExposed } from '@/lib/scene/islandVisibility';
import {
  getAvatarEncounter, paintAvatarTarget, setAvatarAvailability,
} from './avatarEncounter';
import { AVATAR_FOCUS } from './avatarCamera';

// Envelope of the shipped rig's wave, including the raised palm and soles.
export const AVATAR_WORLD_MIN = [18.6, -2.9, -17.7] as const;
export const AVATAR_WORLD_MAX = [24, 6.5, -12.1] as const;

export class AvatarProjection {
  private point = new THREE.Vector3();

  constructor(private torso?: THREE.Object3D) {}

  paint(camera: THREE.Camera, width: number, height: number, rigAvailable: boolean): void {
    const view = getAvatarEncounter();
    if (!rigAvailable || !view.enabled || !isIslandExposed()) {
      setAvatarAvailability(false);
      return;
    }
    camera.updateMatrixWorld();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let corner = 0; corner < 8; corner++) {
      this.point.set(
        corner & 1 ? AVATAR_WORLD_MAX[0] : AVATAR_WORLD_MIN[0],
        corner & 2 ? AVATAR_WORLD_MAX[1] : AVATAR_WORLD_MIN[1],
        corner & 4 ? AVATAR_WORLD_MAX[2] : AVATAR_WORLD_MIN[2],
      ).project(camera);
      if (this.point.z < -1 || this.point.z > 1 || !Number.isFinite(this.point.x + this.point.y)) {
        setAvatarAvailability(false);
        return;
      }
      const x = (this.point.x + 1) * width / 2;
      const y = (1 - this.point.y) * height / 2;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const visible = right > 48 && left < width - 48 && bottom > 100 && top < height - 100 &&
      bottom - top > 48;
    if (visible) {
      const x = Math.max(8, left);
      const y = Math.max(84, top);
      if (this.torso) this.torso.getWorldPosition(this.point);
      else this.point.set(...AVATAR_FOCUS);
      this.point.project(camera);
      const cueX = THREE.MathUtils.clamp((this.point.x + 1) * width / 2, 64, width - 64) - x;
      paintAvatarTarget(x, y, Math.max(48, Math.min(width - 8, right) - x),
        Math.max(48, Math.min(height - 88, bottom + 28) - y), cueX);
    }
    setAvatarAvailability(visible);
  }
}
