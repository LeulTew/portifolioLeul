import * as THREE from 'three';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';
import { createCameraSpline, sampleCameraPose } from '@/lib/camera/cinematicSpline';

export const TV_POSITION = [-10, 0.5, -14] as const;
export const TV_ROTATION = [0.1, Math.PI * 0.2, 0.1] as const;
export const TV_SCALE = 8;
export const TV_SCREEN_POSITION = [0.145, 0.11, 0.13] as const;
export const TV_SCREEN_ROTATION = [-0.03, Math.PI / 2, 0] as const;
export const TV_SCREEN_PITCH = 0.08;
export const TV_SCREEN_WIDTH = 0.55;
export const TV_SCREEN_HEIGHT = 0.32;
export const TV_SCREEN_ASPECT = TV_SCREEN_WIDTH / TV_SCREEN_HEIGHT;
export const PROJECTS_TURN_MS = 2200;
export const PROJECTS_APPROACH_MS = 1400;
export const PROJECTS_STAGE_QUERY = '(min-width: 900px) and (min-height: 560px)';

function transform(
  position: readonly [number, number, number],
  rotation: readonly [number, number, number],
  scale = 1,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(scale, scale, scale),
  );
}

/** This is the existing video plane, including both nested rotations. */
export const TV_SCREEN_WORLD = transform(TV_POSITION, TV_ROTATION, TV_SCALE)
  .multiply(transform(TV_SCREEN_POSITION, TV_SCREEN_ROTATION))
  .multiply(transform([0, 0, 0], [TV_SCREEN_PITCH, 0, 0]));

export const TV_SCREEN_CENTER = new THREE.Vector3().setFromMatrixPosition(TV_SCREEN_WORLD);
export const TV_SCREEN_ORIENTATION = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().extractRotation(TV_SCREEN_WORLD),
);
const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(TV_SCREEN_ORIENTATION);
const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(TV_SCREEN_ORIENTATION);
const worldUp = new THREE.Vector3(0, 1, 0);

export function fitTVScreen(width: number, height: number) {
  // Leave room for the physical upper bezel, the six tabs and fixed navigation.
  const screenHeight = Math.max(160, Math.min((width - 112) / TV_SCREEN_ASPECT, (height - 154) / 1.42));
  const screenWidth = screenHeight * TV_SCREEN_ASPECT;
  return {
    width: screenWidth,
    height: screenHeight,
    centerX: width / 2,
    centerY: 92 + screenHeight * 0.42 + screenHeight / 2,
  };
}

/** Reuses the original turn; only its closing aim frames the actual TV. */
export class ProjectsCameraPose {
  private spline = createCameraSpline();
  private target = new THREE.Vector3();
  private nearPosition = new THREE.Vector3();
  private nearTarget = new THREE.Vector3();
  private look = new THREE.Matrix4();
  private turnOrientation = new THREE.Quaternion();
  private entryPosition = new THREE.Vector3();
  private entryOrientation = new THREE.Quaternion();
  private hasEntry = false;
  private fittedWidth = 900;
  private fittedHeight = 560;
  private fit = fitTVScreen(900, 560);
  private lastTurn = Number.NaN;
  private lastApproach = Number.NaN;
  private lastFov = Number.NaN;
  private parkedPosition = new THREE.Vector3();
  private parkedOrientation = new THREE.Quaternion();

  begin(position?: THREE.Vector3, orientation?: THREE.Quaternion): void {
    this.lastTurn = Number.NaN;
    this.hasEntry = !!position && !!orientation;
    if (position && orientation) {
      this.entryPosition.copy(position);
      this.entryOrientation.copy(orientation);
    }
  }

  sample(
    turn: number, approach: number, width: number, height: number, fov: number,
    position: THREE.Vector3, orientation: THREE.Quaternion,
  ): void {
    if (turn === this.lastTurn && approach === this.lastApproach && fov === this.lastFov &&
        width === this.fittedWidth && height === this.fittedHeight) {
      position.copy(this.parkedPosition);
      orientation.copy(this.parkedOrientation);
      return;
    }
    if (width !== this.fittedWidth || height !== this.fittedHeight) {
      this.fittedWidth = width;
      this.fittedHeight = height;
      this.fit = fitTVScreen(width, height);
    }
    const arc = easeInOutCubic(turn);
    sampleCameraPose(this.spline, arc, position, this.target);
    this.target.lerp(TV_SCREEN_CENTER, easeInOutCubic(Math.max(0, (arc - 0.7) / 0.3)));
    this.look.lookAt(position, this.target, worldUp);
    this.turnOrientation.setFromRotationMatrix(this.look);
    if (this.hasEntry) {
      const arriving = easeInOutCubic(Math.max(0, (arc - 0.7) / 0.3));
      position.lerp(this.entryPosition, arriving);
      this.turnOrientation.slerp(this.entryOrientation, arriving);
    }
    const fit = this.fit;
    const distance = TV_SCREEN_HEIGHT * TV_SCALE * height /
      (2 * fit.height * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
    const verticalOffset = (fit.centerY - height / 2) / fit.height * TV_SCREEN_HEIGHT * TV_SCALE;
    this.nearTarget.copy(TV_SCREEN_CENTER).addScaledVector(screenUp, verticalOffset);
    this.nearPosition.copy(this.nearTarget).addScaledVector(screenNormal, distance);
    const zoom = easeInOutCubic(approach);
    position.lerp(this.nearPosition, zoom);
    orientation.copy(this.turnOrientation).slerp(TV_SCREEN_ORIENTATION, zoom);
    this.lastTurn = turn;
    this.lastApproach = approach;
    this.lastFov = fov;
    this.parkedPosition.copy(position);
    this.parkedOrientation.copy(orientation);
  }
}

/** Maps native-resolution semantic DOM onto the four projected screen corners. */
export class TVScreenProjector {
  private corners = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
  ];
  private values = new Float64Array(16);
  private fittedWidth = 900;
  private fittedHeight = 560;
  private fit = fitTVScreen(900, 560);

  matrix(camera: THREE.Camera, viewportWidth: number, viewportHeight: number): string | null {
    if (viewportWidth !== this.fittedWidth || viewportHeight !== this.fittedHeight) {
      this.fittedWidth = viewportWidth;
      this.fittedHeight = viewportHeight;
      this.fit = fitTVScreen(viewportWidth, viewportHeight);
    }
    const fit = this.fit;
    for (let index = 0; index < 4; index++) {
      const point = this.corners[index];
      point.set(
        (index === 0 || index === 3 ? -1 : 1) * TV_SCREEN_WIDTH / 2,
        (index < 2 ? 1 : -1) * TV_SCREEN_HEIGHT / 2,
        0,
      ).applyMatrix4(TV_SCREEN_WORLD).project(camera);
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.z > 1) return null;
      point.x = (point.x + 1) * viewportWidth / 2;
      point.y = (1 - point.y) * viewportHeight / 2;
    }
    const [a, b, c, d] = this.corners;
    const dx1 = b.x - c.x;
    const dx2 = d.x - c.x;
    const dx3 = a.x - b.x + c.x - d.x;
    const dy1 = b.y - c.y;
    const dy2 = d.y - c.y;
    const dy3 = a.y - b.y + c.y - d.y;
    const denominator = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(denominator) < 0.0001) return null;
    const g = (dx3 * dy2 - dx2 * dy3) / denominator;
    const h = (dx1 * dy3 - dx3 * dy1) / denominator;
    const m = this.values;
    m[0] = (b.x - a.x + g * b.x) / fit.width;
    m[1] = (b.y - a.y + g * b.y) / fit.width;
    m[3] = g / fit.width;
    m[4] = (d.x - a.x + h * d.x) / fit.height;
    m[5] = (d.y - a.y + h * d.y) / fit.height;
    m[7] = h / fit.height;
    m[10] = 1;
    m[12] = a.x;
    m[13] = a.y;
    m[15] = 1;
    return `matrix3d(${m.join(',')})`;
  }
}
