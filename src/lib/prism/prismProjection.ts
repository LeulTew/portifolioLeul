import * as THREE from 'three';
import { writeStyleProperty } from '@/lib/dom/cachedElement';
import { isIslandExposed } from '@/lib/scene/islandVisibility';
import { getIslandSecret } from '@/lib/scene/islandSecret';
import { getPrismExperiment, setPrismAvailable } from './prismExperiment';
import { prismTarget } from './prismTarget';

export { registerPrismTarget } from './prismTarget';

export class PrismProjection {
  private point = new THREE.Vector3();
  private center = new THREE.Vector3();

  paint(mesh: THREE.Mesh, camera: THREE.Camera, width: number, height: number): void {
    if (!getPrismExperiment().enabled || !isIslandExposed() || getIslandSecret() === 'avatar') {
      setPrismAvailable(false); return;
    }
    mesh.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) { setPrismAvailable(false); return; }
    bounds.getCenter(this.center).applyMatrix4(mesh.matrixWorld).project(camera);
    const x = (this.center.x + 1) * width / 2;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      this.point.set(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y,
        i & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
      if (this.point.z <= -1 || this.point.z >= 1) { setPrismAvailable(false); return; }
      left = Math.min(left, (this.point.x + 1) * width / 2);
      right = Math.max(right, (this.point.x + 1) * width / 2);
      top = Math.min(top, (1 - this.point.y) * height / 2);
      bottom = Math.max(bottom, (1 - this.point.y) * height / 2);
    }
    left = Math.max(8, left - 12); right = Math.min(width - 8, right + 12);
    const y = Math.max(84, top - 4), end = Math.min(height - 88, bottom + 24);
    const visible = x > 24 && x < width - 24 && end - y > 48 && right - left > 16;
    const target = prismTarget();
    if (visible && target) {
      const targetWidth = Math.max(48, right - left);
      writeStyleProperty(target, 'transform', `translate3d(${left.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
      writeStyleProperty(target, 'width', `${targetWidth.toFixed(1)}px`);
      writeStyleProperty(target, 'height', `${(end - y).toFixed(1)}px`);
      writeStyleProperty(target, '--avatar-cue-x', `${(THREE.MathUtils.clamp(x, 64, width - 64) - left).toFixed(1)}px`);
    }
    setPrismAvailable(visible);
  }
}
