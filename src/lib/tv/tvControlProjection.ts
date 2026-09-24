import * as THREE from 'three';
import { writeStyleProperty } from '@/lib/dom/cachedElement';
import { getContactView } from '@/lib/contact/contactScene';
import { getIslandReadiness, getIslandSecret } from '@/lib/scene/islandSecret';
import { isWorldOccluded } from '@/lib/render/frameGate';
import { TV_SCREEN_CENTER, TV_SCREEN_ORIENTATION, TV_SCREEN_WORLD, TV_SCREEN_HEIGHT } from '@/lib/projects/tvScreen';
import { TV_CONTROLS, TV_CONTROL_IDS, type TVControlId } from './tvHardware';
import { getTVState, setTVExposure } from './tvState';

let targets: Record<TVControlId, HTMLButtonElement | null> | null = null;
export function registerTVTargets(elements: NonNullable<typeof targets>): () => void {
  targets = elements;
  return () => { if (targets === elements) targets = null; };
}

const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(TV_SCREEN_ORIENTATION);
const STABLE = new Set(['outside', 'revealed', 'framed', 'reading']);

export class TVControlProjection {
  screenPixels = 0;
  private direction = new THREE.Vector3();
  private point = new THREE.Vector3();
  private high = new THREE.Vector3();
  private low = new THREE.Vector3();
  private centers = new Float64Array(6);
  private widths = new Float64Array(3);
  private heights = new Float64Array(3);
  private world = new THREE.Matrix4();
  private projection = new THREE.Matrix4();
  private width = 0;
  private height = 0;

  paint(camera: THREE.Camera, width: number, height: number): void {
    const tv = getTVState();
    const ready = getIslandReadiness();
    if (width < 900 || height < 560 || document.hidden || isWorldOccluded() || getContactView().mode !== 'outside' ||
        getIslandSecret() !== null || !ready.layout || (!ready.hero && tv.phase === 'outside')) {
      setTVExposure(false, 'hidden');
      return;
    }
    camera.updateMatrixWorld();
    this.direction.copy(camera.position).sub(TV_SCREEN_CENTER).normalize();
    if (this.direction.dot(screenNormal) < 0.1) {
      setTVExposure(false, 'hidden'); return;
    }
    if (!this.world.equals(camera.matrixWorld) || !this.projection.equals(camera.projectionMatrix) ||
        width !== this.width || height !== this.height || !tv.exposed) {
      this.world.copy(camera.matrixWorld); this.projection.copy(camera.projectionMatrix);
      this.width = width; this.height = height;
      this.high.set(0, TV_SCREEN_HEIGHT / 2, 0).applyMatrix4(TV_SCREEN_WORLD).project(camera);
      this.low.set(0, -TV_SCREEN_HEIGHT / 2, 0).applyMatrix4(TV_SCREEN_WORLD).project(camera);
      this.screenPixels = Math.abs(this.high.y - this.low.y) * height / 2;
      if (this.high.z < -1 || this.high.z > 1 || this.low.z < -1 || this.low.z > 1 ||
          this.screenPixels < 20) {
        setTVExposure(false, 'hidden'); return;
      }
      for (let i = 0; i < TV_CONTROL_IDS.length; i++) {
        const id = TV_CONTROL_IDS[i], control = TV_CONTROLS[id];
        this.point.set(...control.position).applyMatrix4(TV_SCREEN_WORLD).project(camera);
        this.centers[i * 2] = (this.point.x + 1) * width / 2;
        this.centers[i * 2 + 1] = (1 - this.point.y) * height / 2;
        this.high.set(control.position[0] - control.width / 2, control.position[1], control.position[2])
          .applyMatrix4(TV_SCREEN_WORLD).project(camera);
        this.low.set(control.position[0] + control.width / 2, control.position[1], control.position[2])
          .applyMatrix4(TV_SCREEN_WORLD).project(camera);
        this.widths[i] = Math.max(48, Math.abs(this.low.x - this.high.x) * width / 2);
        this.heights[i] = Math.max(48, control.height / TV_SCREEN_HEIGHT * this.screenPixels);
      }
    }
    const powerX = this.centers[4], powerY = this.centers[5];
    if (powerX < 24 || powerX > width - 24 || powerY < 96 || powerY > height - 28) {
      setTVExposure(false, 'hidden'); return;
    }
    const allFit = this.centers[0] >= this.widths[0] / 2 + 8 &&
      this.centers[2] - this.centers[0] >= (this.widths[0] + this.widths[1]) / 2 + 2 &&
      this.centers[4] - this.centers[2] >= (this.widths[1] + this.widths[2]) / 2 + 2;
    const layout = STABLE.has(tv.phase) ? allFit ? 'all' : 'power' : 'hidden';
    if (targets) {
      for (let i = 0; i < TV_CONTROL_IDS.length; i++) {
        const target = targets[TV_CONTROL_IDS[i]];
        if (!target) continue;
        writeStyleProperty(target, 'transform', `translate3d(${(this.centers[i * 2] - this.widths[i] / 2).toFixed(2)}px, ${(this.centers[i * 2 + 1] - this.heights[i] / 2).toFixed(2)}px, 0)`);
        writeStyleProperty(target, 'width', `${this.widths[i].toFixed(2)}px`);
        writeStyleProperty(target, 'height', `${this.heights[i].toFixed(2)}px`);
      }
    }
    setTVExposure(true, layout);
  }
}
