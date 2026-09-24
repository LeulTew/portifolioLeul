import * as THREE from 'three';
import { easeInOutCubic, phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import {
  finishAvatarReturn, getAvatarEncounter, paintAvatarEncounter, setAvatarEncounterPhase,
} from './avatarEncounter';

export const AVATAR_POSITION = [22, -2.5, -15] as const;
export const AVATAR_ROTATION = [0, Math.PI / 0.55, 0] as const;
export const AVATAR_SCALE = [8, 8, 8] as const;
export const AVATAR_FOCUS = [21.5, 3.75, -15] as const;
export const AVATAR_APPROACH_MS = 1650;
export const AVATAR_RETURN_MS = 1200;
export const AVATAR_YIELD_MS = 520;
export const AVATAR_NOD_MS = 1050;

const up = new THREE.Vector3(0, 1, 0);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A pose compositor, never a second render loop or camera owner. */
export class AvatarCameraTake {
  private source = new THREE.Vector3();
  private sourceOrientation = new THREE.Quaternion();
  private sourceAim = new THREE.Vector3();
  private focus = new THREE.Vector3(...AVATAR_FOCUS);
  private destination = new THREE.Vector3();
  private destinationAim = new THREE.Vector3();
  private controlOne = new THREE.Vector3();
  private controlTwo = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private correction = new THREE.Vector3();
  private fromPosition = new THREE.Vector3();
  private fromOrientation = new THREE.Quaternion();
  private basePosition = new THREE.Vector3();
  private baseOrientation = new THREE.Quaternion();
  private look = new THREE.Matrix4();
  private lookOrientation = new THREE.Quaternion();
  private revision = -1;
  private started = false;
  private elapsed = 0;
  private meetingTime = 0;
  private returnStart = 1;
  private attentionFrom = 0;
  private nodFrom = 0;

  private begin(position: THREE.Vector3, orientation: THREE.Quaternion, height: number, fov: number, aspect: number) {
    this.source.copy(position);
    this.sourceOrientation.copy(orientation);
    this.forward.set(0, 0, -1).applyQuaternion(orientation);
    const distance = Math.max(10, this.correction.copy(this.focus).sub(position).dot(this.forward));
    this.sourceAim.copy(position).addScaledVector(this.forward, distance);
    const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const raisedPalmFit = (6.3 - this.focus.y) / (tangent * Math.max(0.1, 1 - 176 / height));
    const shoulderFit = 6 / (2 * aspect * tangent * 0.82);
    const radius = Math.max(7.6, raisedPalmFit, shoulderFit);
    const azimuth = THREE.MathUtils.degToRad(8);
    this.destination.set(this.focus.x + Math.sin(azimuth) * radius,
      4.8, this.focus.z + Math.cos(azimuth) * radius);
    this.right.set(Math.cos(azimuth), 0, -Math.sin(azimuth));
    this.destinationAim.copy(this.focus).addScaledVector(this.right, 0.65);
    this.controlOne.copy(this.source).lerp(this.destination, 0.3);
    const rearEntry = this.source.z < -8;
    this.controlOne.y = Math.max(this.source.y, this.destination.y, rearEntry ? 11 : 0) + 1.5;
    this.controlTwo.copy(this.source).lerp(this.destination, 0.77);
    this.controlTwo.y = Math.max(this.destination.y + 1.5, rearEntry ? 10.5 : 6.3);
    this.controlTwo.addScaledVector(this.right, 1.6);
    this.meetingTime = 0;
    this.started = true;
  }

  private sample(progress: number, position: THREE.Vector3, orientation: THREE.Quaternion) {
    const t = easeInOutCubic(progress);
    const s = 1 - t;
    position.copy(this.source).multiplyScalar(s * s * s)
      .addScaledVector(this.controlOne, 3 * s * s * t)
      .addScaledVector(this.controlTwo, 3 * s * t * t)
      .addScaledVector(this.destination, t * t * t);
    const attention = 1 - Math.pow(1 - clamp(progress * 1.35), 3);
    this.aim.copy(this.sourceAim).lerp(this.destinationAim, attention);
    this.look.lookAt(position, this.aim, up);
    this.lookOrientation.setFromRotationMatrix(this.look);
    orientation.copy(this.sourceOrientation).slerp(this.lookOrientation, easeInOutCubic(clamp(progress * 2)));
  }

  /**
   * camera contains this frame's authoritative base pose. displayed* is the
   * previous visible pose, captured before that base was computed.
   */
  apply(
    camera: THREE.Camera, displayedPosition: THREE.Vector3, displayedOrientation: THREE.Quaternion,
    height: number, deltaSeconds: number, reduced: boolean,
  ): boolean {
    const view = getAvatarEncounter();
    if (view.phase === 'idle') {
      this.started = false;
      return false;
    }
    this.basePosition.copy(camera.position);
    this.baseOrientation.copy(camera.quaternion);
    let dt = phaseFrameDelta(deltaSeconds * 1000);
    if (this.revision !== view.revision) {
      this.revision = view.revision;
      this.elapsed = 0;
      dt = 0;
      if (view.phase === 'approaching') {
        this.begin(displayedPosition, displayedOrientation, height,
          camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
          camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.6);
      } else {
        this.fromPosition.copy(displayedPosition);
        this.fromOrientation.copy(displayedOrientation);
        this.returnStart = view.progress;
        this.attentionFrom = view.attention;
        this.nodFrom = view.nod;
      }
    }
    if (!this.started) {
      finishAvatarReturn();
      return false;
    }
    this.elapsed += dt;
    let progress = view.progress;
    if (view.phase === 'yielding') {
      const release = reduced ? 1 : easeInOutCubic(clamp(this.elapsed / AVATAR_YIELD_MS));
      camera.position.copy(this.fromPosition).lerp(this.basePosition, release);
      const depth = this.basePosition.z - this.fromPosition.z;
      const crossing = depth ? (-15 - this.fromPosition.z) / depth : -1;
      const crossingX = this.fromPosition.x + (this.basePosition.x - this.fromPosition.x) * crossing;
      const depthWeight = easeInOutCubic(clamp(crossing / 0.1)) *
        easeInOutCubic(clamp((1 - crossing) / 0.1));
      const sideWeight = easeInOutCubic(clamp((crossingX - 6.5) / 3)) *
        easeInOutCubic(clamp((17.5 - crossingX) / 3));
      if (depthWeight * sideWeight > 0) {
        const crossingY = this.fromPosition.y + (this.basePosition.y - this.fromPosition.y) * crossing;
        const lift = Math.max(0, 10.5 - crossingY) * depthWeight * sideWeight /
          Math.sin(Math.PI * Math.max(0.025, Math.min(0.975, crossing)));
        camera.position.y += Math.sin(Math.PI * release) * lift;
      }
      camera.quaternion.copy(this.fromOrientation).slerp(this.baseOrientation, release);
      paintAvatarEncounter(progress * (1 - release), this.attentionFrom * (1 - release),
        this.nodFrom * (1 - release), 0);
      if (release === 1) { finishAvatarReturn(); this.started = false; return false; }
      return true;
    }
    if (view.phase === 'approaching') {
      progress = reduced ? 1 : clamp(progress + dt / AVATAR_APPROACH_MS);
      if (progress === 1) setAvatarEncounterPhase('meeting');
    } else if (view.phase === 'returning') {
      progress = reduced ? 0 : Math.max(0, progress - dt / AVATAR_RETURN_MS);
      if (progress === 0) {
        paintAvatarEncounter(0, 0, 0, 0);
        finishAvatarReturn();
        this.started = false;
        return false;
      }
    } else {
      this.meetingTime = reduced ? AVATAR_NOD_MS : Math.min(AVATAR_NOD_MS, this.meetingTime + dt);
    }
    this.sample(progress, camera.position, camera.quaternion);
    if (view.phase === 'returning') {
      const returnMix = easeInOutCubic(1 - progress / Math.max(this.returnStart, 0.0001));
      this.correction.copy(this.basePosition).sub(this.source).multiplyScalar(returnMix);
      camera.position.add(this.correction);
      camera.quaternion.slerp(this.baseOrientation, returnMix);
    }
    const attention = reduced ? 0 : easeInOutCubic(clamp((progress - 0.15) / 0.7));
    const nod = view.phase === 'returning' && !reduced
      ? this.nodFrom * progress / Math.max(this.returnStart, 0.0001)
      : view.phase === 'meeting' && !reduced ? Math.sin(Math.PI * this.meetingTime / AVATAR_NOD_MS) : 0;
    const reveal = reduced ? 1 : easeInOutCubic(clamp((progress - 0.68) / 0.32));
    paintAvatarEncounter(progress, attention, nod, reveal);
    return true;
  }
}
