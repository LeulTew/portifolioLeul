import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_CHAPTERS, createCameraSpline, sampleCameraPose } from '@/lib/camera/cinematicSpline';
import { AvatarCameraTake, AVATAR_FOCUS } from './avatarCamera';
import {
  abortAvatarEncounter, getAvatarEncounter, requestAvatarEncounter, resetAvatarEncounter,
  returnFromAvatarEncounter, setAvatarAvailability, setAvatarEncounterEnabled, yieldAvatarEncounter,
} from './avatarEncounter';
import { AVATAR_WORLD_MAX, AVATAR_WORLD_MIN } from './avatarProjection';

function fixture(width = 1440, height = 900) {
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(...CAMERA_CHAPTERS[0].position);
  camera.lookAt(...CAMERA_CHAPTERS[0].target);
  const base = camera.position.clone(), baseOrientation = camera.quaternion.clone();
  const displayed = new THREE.Vector3(), orientation = new THREE.Quaternion();
  const take = new AvatarCameraTake();
  const frame = (seconds = 1 / 60, reduced = false) => {
    displayed.copy(camera.position); orientation.copy(camera.quaternion);
    camera.position.copy(base); camera.quaternion.copy(baseOrientation);
    return take.apply(camera, displayed, orientation, height, seconds, reduced);
  };
  const advance = (frames: number, reduced = false) => {
    for (let i = 0; i < frames; i++) frame(1 / 60, reduced);
  };
  setAvatarEncounterEnabled(true);
  setAvatarAvailability(true);
  return { camera, base, baseOrientation, frame, advance };
}

beforeEach(resetAvatarEncounter);

describe('the real avatar camera encounter', () => {
  it('does not alter the ordinary camera when no encounter was requested', () => {
    const { camera, base, baseOrientation, frame } = fixture();
    expect(frame()).toBe(false);
    expect(camera.position.equals(base)).toBe(true);
    expect(camera.quaternion.equals(baseOrientation)).toBe(true);
  });

  it('starts at the displayed pose, not a fabricated Hero position', () => {
    const { camera, frame } = fixture();
    camera.position.set(7, 11, 26);
    camera.lookAt(3, 1, -12);
    const from = camera.position.clone(), rotation = camera.quaternion.clone();
    requestAvatarEncounter();
    frame();
    expect(camera.position.distanceTo(from)).toBeLessThan(1e-10);
    expect(camera.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
  });

  it('actually dollies more than 30 units and changes the viewing side by over 25 degrees', () => {
    const { camera, base, frame, advance } = fixture();
    requestAvatarEncounter(); frame(); advance(100);
    expect(getAvatarEncounter().phase).toBe('meeting');
    expect(camera.position.distanceTo(base)).toBeGreaterThan(30);
    const focus = new THREE.Vector3(...AVATAR_FOCUS);
    const before = base.clone().sub(focus).setY(0).normalize();
    const after = camera.position.clone().sub(focus).setY(0).normalize();
    expect(THREE.MathUtils.radToDeg(before.angleTo(after))).toBeGreaterThan(25);
    expect(camera.fov).toBe(50);
  });

  it.each([[900, 560], [900, 900], [1440, 900], [3840, 2160]])(
    'frames the head, raised palm and upper body, not another full-body shot, at %ix%i', (width, height) => {
      const { camera, frame, advance } = fixture(width, height);
      requestAvatarEncounter(); frame(); advance(100);
      camera.updateMatrixWorld();
      const head = new THREE.Vector3(21.5, 5.8, -15).project(camera);
      const palm = new THREE.Vector3(19.6, 6.2, -14.2).project(camera);
      const waist = new THREE.Vector3(21.5, 1.1, -15).project(camera);
      const sole = new THREE.Vector3(21.5, -2.6, -15).project(camera);
      expect(head.y).toBeLessThan(0.9);
      expect(palm.y).toBeLessThan(1 - 140 / height);
      expect(Math.abs(palm.x)).toBeLessThan(0.93);
      expect(waist.y).toBeGreaterThan(-1);
      expect(sole.y).toBeLessThan(-1);
      expect(Math.abs(head.x)).toBeLessThan(0.6);
      const screenHeight = (head.y - waist.y) * height / 2;
      expect(screenHeight).toBeGreaterThan(height * 0.5);
    },
  );

  it('keeps the swept camera above the terrain and away from the avatar volume', () => {
    const { camera, frame } = fixture();
    const body = new THREE.Box3(new THREE.Vector3(...AVATAR_WORLD_MIN), new THREE.Vector3(...AVATAR_WORLD_MAX));
    requestAvatarEncounter(); frame();
    for (let i = 0; i < 110; i++) {
      frame();
      expect(camera.position.y - camera.near).toBeGreaterThanOrEqual(4.69);
      expect(body.distanceToPoint(camera.position)).toBeGreaterThan(3);
    }
  });

  it('clears the tall prism on approach and input-yield from a rear island view', () => {
    const { camera, base, baseOrientation, frame, advance } = fixture();
    camera.position.set(0, 5, -30);
    camera.lookAt(-10, 0.5, -14);
    base.copy(camera.position); baseOrientation.copy(camera.quaternion);
    const prism = new THREE.Box3(new THREE.Vector3(9.9, -4.3, -15.4), new THREE.Vector3(14.1, 8.3, -14.6));
    requestAvatarEncounter(); frame();
    for (let i = 0; i < 110; i++) {
      frame();
      expect(prism.distanceToPoint(camera.position)).toBeGreaterThan(0.4);
    }
    yieldAvatarEncounter(); frame(0);
    for (let i = 0; i < 40; i++) {
      frame();
      expect(prism.distanceToPoint(camera.position)).toBeGreaterThan(0.4);
    }
    advance(10);
    expect(camera.position.equals(base)).toBe(true);
  });

  it.each([0, 8, 35, 75, 125])('returns continuously when closed after %i frames', frames => {
    const { camera, base, baseOrientation, frame, advance } = fixture();
    requestAvatarEncounter(); frame(); advance(frames);
    const before = camera.position.clone(), rotation = camera.quaternion.clone();
    const nod = getAvatarEncounter().nod;
    returnFromAvatarEncounter();
    frame(0);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-8);
    expect(camera.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
    if (frames) expect(getAvatarEncounter().nod).toBeCloseTo(nod, 8);
    advance(90);
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.distanceTo(base)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(baseOrientation)).toBeLessThan(1e-7);
  });

  it('releases an immediate close made before the first drawn frame', () => {
    const { frame } = fixture();
    requestAvatarEncounter();
    returnFromAvatarEncounter();
    expect(frame()).toBe(false);
    expect(getAvatarEncounter().phase).toBe('idle');
  });

  it('yields continuously to a moving authoritative chapter without replaying Hero', () => {
    const { camera, base, baseOrientation, frame, advance } = fixture();
    requestAvatarEncounter(); frame(); advance(80);
    const from = camera.position.clone(), rotation = camera.quaternion.clone();
    yieldAvatarEncounter();
    base.set(-2, 10, 30);
    frame(0);
    expect(camera.position.distanceTo(from)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
    for (let i = 0; i < 35; i++) {
      base.x -= 0.2;
      baseOrientation.setFromEuler(new THREE.Euler(0, i / 100, 0));
      frame();
    }
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.distanceTo(base)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(baseOrientation)).toBeLessThan(1e-7);
  });

  it('respects navigation cancellation and never retakes the camera', () => {
    const { camera, base, frame, advance } = fixture();
    requestAvatarEncounter(); frame(); advance(55);
    returnFromAvatarEncounter(); frame(); advance(5);
    abortAvatarEncounter('navigation');
    base.set(-10, 15, -20);
    advance(300);
    expect(camera.position.equals(base)).toBe(true);
    expect(getAvatarEncounter().phase).toBe('idle');
  });

  it('does not switch prism clearance on abruptly as the live base crosses its corridor', () => {
    const { camera, base, baseOrientation, frame, advance } = fixture();
    const spline = createCameraSpline();
    const target = new THREE.Vector3(), destination = new THREE.Vector3(), destinationTarget = new THREE.Vector3();
    const baseCamera = new THREE.PerspectiveCamera(50);
    sampleCameraPose(spline, 0.92, base, target);
    camera.position.copy(base); camera.lookAt(target); baseOrientation.copy(camera.quaternion);
    requestAvatarEncounter(); frame(); advance(110);
    yieldAvatarEncounter(); frame(0);
    sampleCameraPose(spline, 0.98, destination, destinationTarget);
    const previous = camera.position.clone();
    let largestVerticalStep = 0;
    for (let i = 0; i < 40; i++) {
      for (const axis of ['x', 'y', 'z'] as const) {
        base[axis] = THREE.MathUtils.damp(base[axis], destination[axis], 3.2, 1 / 60);
        target[axis] = THREE.MathUtils.damp(target[axis], destinationTarget[axis], 4, 1 / 60);
      }
      baseCamera.position.copy(base); baseCamera.lookAt(target); baseOrientation.copy(baseCamera.quaternion);
      frame();
      largestVerticalStep = Math.max(largestVerticalStep, Math.abs(camera.position.y - previous.y));
      previous.copy(camera.position);
    }
    expect(largestVerticalStep).toBeLessThan(1);
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.distanceTo(base)).toBeLessThan(1e-9);
  });

  it('uses a deliberate real portrait cut under reduced motion, and closes a returning cut', () => {
    const { camera, base, frame } = fixture();
    requestAvatarEncounter(); frame(1 / 60, true);
    expect(getAvatarEncounter().phase).toBe('meeting');
    expect(camera.position.distanceTo(base)).toBeGreaterThan(30);
    expect(getAvatarEncounter().attention).toBe(0);
    expect(getAvatarEncounter().nod).toBe(0);
    returnFromAvatarEncounter(); frame(1 / 60, true);
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.equals(base)).toBe(true);
  });

  it('cannot spend a suspended 30 seconds in one frame or repeat the nod', () => {
    const { frame, advance } = fixture();
    requestAvatarEncounter(); frame(); frame(30);
    expect(getAvatarEncounter().progress).toBeCloseTo(50 / 1650);
    advance(100);
    advance(30);
    expect(getAvatarEncounter().nod).toBeGreaterThan(0.8);
    advance(80);
    expect(getAvatarEncounter().nod).toBeCloseTo(0);
    advance(300);
    expect(getAvatarEncounter().nod).toBeCloseTo(0);
  });
});
