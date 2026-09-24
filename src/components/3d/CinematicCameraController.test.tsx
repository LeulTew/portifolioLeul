/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CinematicCameraController } from './CinematicCameraController';
import { CAMERA_CHAPTERS, CAMERA_ARC_END } from '@/lib/camera/cinematicSpline';
import { setProjectsReading, setProjectsView } from '@/lib/projects/projectsScene';
import { ProjectsCameraPose } from '@/lib/projects/tvScreen';
import { CONTACT_SKY_ORIENTATION, CONTACT_SKY_POSITION } from '@/lib/camera/contactFlight';
import {
  beginContactFlight, isContactPoseCommitted, parkContactSky, releaseContactSky, setContactProgress,
} from '@/lib/contact/contactScene';
import {
  getAvatarEncounter, requestAvatarEncounter, resetAvatarEncounter,
  returnFromAvatarEncounter, setAvatarAvailability, setAvatarEncounterEnabled,
} from '@/lib/avatar/avatarEncounter';

const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

// Shared and mutated in place: the component captures this object once at
// render, exactly as the real useScroll hook behaves.
const scrollState = { offset: 0 };
let pointer = { x: 0, y: 0 };
let frameCallback: ((state: any, delta: number) => void) | null = null;

vi.mock('@react-three/fiber', () => ({
  useThree: (selector?: (state: any) => unknown) => {
    const state = { camera, size: { width: 1920, height: 1080 } };
    return selector ? selector(state) : state;
  },
  useFrame: (callback: (state: any, delta: number) => void) => {
    frameCallback = callback;
  },
}));

vi.mock('@react-three/drei', () => ({
  useScroll: () => scrollState,
}));

const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion(),
}));
vi.mock('@/lib/gateways/gpuTier', () => ({ getGpuTier: () => ({ tier: 'high' }) }));

/** Runs `count` frames of the loop, which is how damping is meant to converge. */
let clockTime = 0;

const advance = (count = 1, delta = 0.016) => {
  for (let i = 0; i < count; i += 1) {
    // Monotonic across the whole file, as a real clock is. Restarting it per
    // call would ask the render gate to accept time running backwards.
    clockTime += delta;
    const now = clockTime;
    frameCallback?.({ mouse: pointer, size: { width: 1920, height: 1080 }, clock: { elapsedTime: now } }, delta);
  }
};

const mount = (props: Record<string, unknown> = {}) =>
  render(<CinematicCameraController {...props} />);

const chapterVec = (index: number) =>
  new THREE.Vector3(...CAMERA_CHAPTERS[index].position);

describe('CinematicCameraController', () => {
  beforeEach(() => {
    resetAvatarEncounter();
    setProjectsView(false, 0, 0);
    releaseContactSky();
    scrollState.offset = 0;
    pointer = { x: 0, y: 0 };
    frameCallback = null;
    reducedMotion.mockReturnValue(false);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
  });

  afterEach(() => {
    resetAvatarEncounter();
    setProjectsView(false, 0, 0);
    releaseContactSky();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders nothing into the DOM', () => {
    const { container } = mount();
    expect(container.firstChild).toBeNull();
  });

  it('takes the opening shot on the first frame instead of easing in', () => {
    mount({ mouseSway: 0 });
    advance(1);

    expect(camera.position.distanceTo(chapterVec(0))).toBeCloseTo(0, 5);
  });

  const meet = () => {
    setAvatarEncounterEnabled(true);
    setAvatarAvailability(true);
    expect(requestAvatarEncounter()).toBe(true);
  };

  it('composes a real portrait through this owner and returns to the live chapter pose', () => {
    mount({ mouseSway: 0 });
    advance();
    const origin = camera.position.clone(), orientation = camera.quaternion.clone(), layers = camera.layers.mask;
    meet();
    advance(130);
    expect(getAvatarEncounter().phase).toBe('meeting');
    expect(camera.position.distanceTo(origin)).toBeGreaterThan(30);
    returnFromAvatarEncounter();
    advance(100);
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.distanceTo(origin)).toBeLessThan(1e-8);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
    expect(camera.fov).toBe(50);
    expect(camera.layers.mask).toBe(layers);
  });

  it('lets a mandatory TV turn advance while continuously yielding the optional portrait', () => {
    mount({ mouseSway: 0 });
    setProjectsView(true, 0, 0, 'skills');
    advance();
    meet(); advance(55);
    const displayed = camera.position.clone();
    setProjectsView(true, 0.2, 0);
    advance();
    expect(getAvatarEncounter().phase).toBe('yielding');
    expect(camera.position.distanceTo(displayed)).toBeLessThan(1e-8);
    for (let i = 1; i <= 40; i++) {
      setProjectsView(true, 0.2 + i / 100, 0);
      advance();
    }
    expect(getAvatarEncounter().phase).toBe('idle');
    const expected = new THREE.Vector3(), orientation = new THREE.Quaternion();
    new ProjectsCameraPose().sample(0.6, 0, 1920, 1080, 50, expected, orientation);
    expect(camera.position.distanceTo(expected)).toBeLessThan(1e-8);
    expect(camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7);
  });

  it('cannot reclaim the camera after Contact takes priority over an encounter', () => {
    mount({ mouseSway: 0 }); advance();
    meet(); advance(110);
    parkContactSky();
    advance();
    expect(getAvatarEncounter().phase).toBe('idle');
    expect(camera.position.equals(CONTACT_SKY_POSITION)).toBe(true);
    advance(200);
    expect(camera.position.equals(CONTACT_SKY_POSITION)).toBe(true);
    expect(camera.quaternion.angleTo(CONTACT_SKY_ORIENTATION)).toBeLessThan(1e-7);
  });

  it('travels toward the closing shot as the arc completes', () => {
    mount({ mouseSway: 0 });
    advance(1);

    scrollState.offset = CAMERA_ARC_END;
    advance(400);

    const last = chapterVec(CAMERA_CHAPTERS.length - 1);
    expect(camera.position.distanceTo(last)).toBeLessThan(0.05);
  });

  it('holds the closing shot for every scroll past the arc end', () => {
    mount({ mouseSway: 0 });
    advance(1);

    scrollState.offset = CAMERA_ARC_END;
    advance(400);
    const atArcEnd = camera.position.clone();

    // This is the seamless-continuation guarantee: the DOM keeps scrolling,
    // the viewpoint does not drift or overshoot.
    scrollState.offset = 1;
    advance(200);

    expect(camera.position.distanceTo(atArcEnd)).toBeLessThan(1e-6);
  });

  it('eases between shots rather than snapping', () => {
    mount({ mouseSway: 0 });
    advance(1);
    const opening = camera.position.clone();

    scrollState.offset = CAMERA_ARC_END;
    advance(1);

    const moved = opening.distanceTo(camera.position);
    const total = opening.distanceTo(chapterVec(CAMERA_CHAPTERS.length - 1));
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(total * 0.5);
  });

  it('offsets the viewpoint with the pointer', () => {
    mount({ mouseSway: 2 });
    pointer = { x: 1, y: 0 };
    advance(1);

    expect(camera.position.x).toBeCloseTo(CAMERA_CHAPTERS[0].position[0] + 2, 5);
  });

  it('leaves the viewpoint unswayed when pointer parallax is disabled', () => {
    mount({ mouseSway: 0 });
    pointer = { x: 1, y: 1 };
    advance(1);

    expect(camera.position.distanceTo(chapterVec(0))).toBeCloseTo(0, 5);
  });

  it('uses the time-paced Projects pose exactly, regardless of spent scroll or pointer', () => {
    mount({ mouseSway: 5 });
    advance();
    setProjectsView(true, 1, 0.6);
    scrollState.offset = 1;
    pointer = { x: 1, y: 1 };
    advance();
    const expected = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    new ProjectsCameraPose().sample(1, 0.6, 1920, 1080, 50, expected, quaternion);
    expect(camera.position.distanceTo(expected)).toBeLessThan(1e-8);
    expect(camera.quaternion.angleTo(quaternion)).toBeLessThan(1e-7);
    scrollState.offset = 0;
    advance();
    expect(camera.position.distanceTo(expected)).toBeLessThan(1e-8);
  });

  it('composes one flight from actual TV parallax and retraces it before handing back to the TV', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query.includes('pointer: fine'), media: query,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    mount();
    setProjectsView(true, 1, 1, 'skills');
    setProjectsReading(true);
    advance();
    window.dispatchEvent(new MouseEvent('pointermove', {
      clientX: window.innerWidth - 1, clientY: 1,
    }));
    advance(200);
    const actualTV = camera.position.clone();
    const actualRotation = camera.quaternion.clone();
    const nominal = new THREE.Vector3();
    const nominalRotation = new THREE.Quaternion();
    new ProjectsCameraPose().sample(1, 1, 1920, 1080, 50, nominal, nominalRotation);
    expect(actualTV.distanceTo(nominal)).toBeGreaterThan(0.1);

    beginContactFlight(1);
    setProjectsReading(false);
    advance();
    expect(camera.position.distanceTo(actualTV)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(actualRotation)).toBeLessThan(1e-7);
    setContactProgress(0.45);
    advance();
    const outbound = camera.position.clone();
    const outboundRotation = camera.quaternion.clone();
    scrollState.offset = 0;
    pointer = { x: -1, y: -1 };
    advance(10);
    expect(camera.position.equals(outbound)).toBe(true);
    setContactProgress(1);
    advance();
    await Promise.resolve();
    expect(isContactPoseCommitted()).toBe(true);
    parkContactSky();
    setProjectsView(false, 1, 0);
    advance(100);
    expect(camera.position.distanceTo(CONTACT_SKY_POSITION)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(CONTACT_SKY_ORIENTATION)).toBeLessThan(1e-7);
    expect(camera.fov).toBe(50);

    setProjectsView(true, 1, 0, 'contact');
    beginContactFlight(-1);
    advance();
    expect(camera.position.distanceTo(CONTACT_SKY_POSITION)).toBeLessThan(1e-9);
    setContactProgress(0.45);
    advance();
    expect(camera.position.distanceTo(outbound)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(outboundRotation)).toBeLessThan(1e-7);
    setContactProgress(0);
    setProjectsView(true, 1, 1);
    advance();
    await Promise.resolve();
    expect(isContactPoseCommitted()).toBe(true);
    expect(camera.position.distanceTo(actualTV)).toBeLessThan(1e-9);
    releaseContactSky();
    setProjectsReading(true);
    advance();
    expect(camera.position.distanceTo(actualTV)).toBeLessThan(1e-5);

    setProjectsReading(false);
    setProjectsView(true, 1, 0);
    advance();
    new ProjectsCameraPose().sample(1, 0, 1920, 1080, 50, nominal, nominalRotation);
    expect(camera.position.distanceTo(nominal)).toBeLessThan(1e-9);
    expect(camera.quaternion.angleTo(nominalRotation)).toBeLessThan(1e-7);
  });

  it('settles navbar Contact directly without changing camera layers or waiting for clouds', () => {
    mount();
    advance();
    const layers = camera.layers.mask;
    parkContactSky();
    scrollState.offset = 0.1;
    pointer = { x: 1, y: -1 };
    advance();
    expect(camera.position.equals(CONTACT_SKY_POSITION)).toBe(true);
    expect(camera.layers.mask).toBe(layers);
    advance(200);
    expect(camera.position.equals(CONTACT_SKY_POSITION)).toBe(true);
  });

  it('tolerates a frame state with no pointer', () => {
    mount();
    expect(() => frameCallback?.({ clock: { elapsedTime: 0 } }, 0.016)).not.toThrow();
  });

  it('clamps a long frame delta so a backgrounded tab cannot teleport the camera', () => {
    mount({ mouseSway: 0 });
    advance(1);
    const opening = camera.position.clone();

    scrollState.offset = CAMERA_ARC_END;
    // One frame with a 30s delta, as a restored tab reports.
    frameCallback?.({ mouse: pointer, clock: { elapsedTime: 30 } }, 30);
    const jumped = opening.distanceTo(camera.position);

    camera.position.copy(opening);
    frameCallback?.({ mouse: pointer, clock: { elapsedTime: 30 } }, 0.1);
    const clamped = opening.distanceTo(camera.position);

    expect(jumped).toBeCloseTo(clamped, 5);
  });

  describe('reduced motion', () => {
    beforeEach(() => reducedMotion.mockReturnValue(true));

    it('cuts straight to the nearest authored shot with no easing', () => {
      mount();
      scrollState.offset = CAMERA_ARC_END;
      advance(1);

      const last = chapterVec(CAMERA_CHAPTERS.length - 1);
      expect(camera.position.distanceTo(last)).toBeCloseTo(0, 5);
    });

    it('snaps between discrete chapters rather than scrubbing continuously', () => {
      mount();
      scrollState.offset = CAMERA_ARC_END * 0.5;
      advance(1);

      // Midway through the arc lands exactly on chapter 2, not between shots.
      expect(camera.position.distanceTo(chapterVec(2))).toBeCloseTo(0, 5);
    });

    it('ignores pointer parallax entirely', () => {
      mount({ mouseSway: 5 });
      pointer = { x: 1, y: 1 };
      advance(1);

      expect(camera.position.distanceTo(chapterVec(0))).toBeCloseTo(0, 5);
    });
  });
});
