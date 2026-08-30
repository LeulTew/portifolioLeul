/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { CinematicCameraController } from './CinematicCameraController';
import { CAMERA_CHAPTERS, CAMERA_ARC_END } from '@/lib/camera/cinematicSpline';
import { setCameraHold } from '@/lib/camera/cameraHold';
import { NO_HOLD } from '@/lib/camera/holdRange';

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

/** Runs `count` frames of the loop, which is how damping is meant to converge. */
const advance = (count = 1, delta = 0.016) => {
  for (let i = 0; i < count; i += 1) {
    frameCallback?.({ mouse: pointer, clock: { getElapsedTime: () => i * delta } }, delta);
  }
};

const mount = (props: Record<string, unknown> = {}) =>
  render(<CinematicCameraController {...props} />);

const chapterVec = (index: number) =>
  new THREE.Vector3(...CAMERA_CHAPTERS[index].position);

describe('CinematicCameraController', () => {
  beforeEach(() => {
    scrollState.offset = 0;
    pointer = { x: 0, y: 0 };
    frameCallback = null;
    reducedMotion.mockReturnValue(false);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
  });

  afterEach(() => {
    vi.clearAllMocks();
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

  it('tolerates a frame state with no pointer', () => {
    mount();
    expect(() => frameCallback?.({ clock: { getElapsedTime: () => 0 } }, 0.016)).not.toThrow();
  });

  it('clamps a long frame delta so a backgrounded tab cannot teleport the camera', () => {
    mount({ mouseSway: 0 });
    advance(1);
    const opening = camera.position.clone();

    scrollState.offset = CAMERA_ARC_END;
    // One frame with a 30s delta, as a restored tab reports.
    frameCallback?.({ mouse: pointer, clock: { getElapsedTime: () => 30 } }, 30);
    const jumped = opening.distanceTo(camera.position);

    camera.position.copy(opening);
    frameCallback?.({ mouse: pointer, clock: { getElapsedTime: () => 30 } }, 0.1);
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

describe('CinematicCameraController while held', () => {
  beforeEach(() => {
    scrollState.offset = 0;
    pointer = { x: 0, y: 0 };
    frameCallback = null;
    reducedMotion.mockReturnValue(false);
    camera.position.set(0, 0, 0);
    setCameraHold({ start: 0.2, end: 0.8 });
  });

  afterEach(() => setCameraHold(NO_HOLD));

  it('does not sway with the pointer while the world is held', () => {
    // The hold freezes what the scroll asks for, but the pointer was still
    // added on top of it -- so a section meant to be completely still drifted
    // with the mouse the whole time it was up.
    scrollState.offset = 0.5;
    mount({ mouseSway: 4 });

    pointer = { x: 0, y: 0 };
    advance(140);
    const still = camera.position.clone();

    pointer = { x: 1, y: 1 };
    advance(140);

    expect(camera.position.distanceTo(still)).toBeLessThan(0.001);
  });

  it('still sways once the hold is over', () => {
    scrollState.offset = 0.9;
    mount({ mouseSway: 4 });

    pointer = { x: 0, y: 0 };
    advance(140);
    const still = camera.position.clone();

    pointer = { x: 1, y: 1 };
    advance(140);

    expect(camera.position.distanceTo(still)).toBeGreaterThan(0.1);
  });

  it('holds the same pose across the whole held range', () => {
    scrollState.offset = 0.25;
    mount({ mouseSway: 0 });
    advance(200);
    const early = camera.position.clone();

    scrollState.offset = 0.75;
    advance(200);

    expect(camera.position.distanceTo(early)).toBeLessThan(0.001);
  });
});
