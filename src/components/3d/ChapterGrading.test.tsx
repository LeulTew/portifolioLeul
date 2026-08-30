/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import * as THREE from 'three';
import { ChapterGrading } from './ChapterGrading';
import { CAMERA_ARC_END } from '@/lib/camera/cinematicSpline';
import { DARK_GRADES, LIGHT_GRADES } from '@/lib/atmosphere/chapterGrade';

const scene = new THREE.Scene();
const scrollState = { offset: 0 };
let frameCallback: ((state: any, delta: number) => void) | null = null;

vi.mock('@react-three/fiber', () => ({
  useThree: (selector?: (state: any) => unknown) => {
    const state = { scene };
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

const advance = (count = 1, delta = 0.016) => {
  for (let i = 0; i < count; i += 1) frameCallback?.({}, delta);
};

const setup = (isLight = false) => {
  const ambientRef = createRef<THREE.AmbientLight>();
  const keyLightRef = createRef<THREE.DirectionalLight>();
  (ambientRef as any).current = new THREE.AmbientLight('#ffffff', 1);
  (keyLightRef as any).current = new THREE.DirectionalLight('#ffffff', 1);

  render(
    <ChapterGrading isLight={isLight} ambientRef={ambientRef} keyLightRef={keyLightRef} />
  );

  return { ambientRef, keyLightRef };
};

describe('ChapterGrading', () => {
  beforeEach(() => {
    frameCallback = null;
    scrollState.offset = 0;
    reducedMotion.mockReturnValue(false);
    scene.fog = new THREE.Fog('#001a1a', 30, 70);
  });

  it('renders nothing into the DOM', () => {
    const ambientRef = createRef<THREE.AmbientLight>();
    const keyLightRef = createRef<THREE.DirectionalLight>();
    const { container } = render(
      <ChapterGrading isLight={false} ambientRef={ambientRef} keyLightRef={keyLightRef} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('converges the lights onto the opening grade', () => {
    const { ambientRef, keyLightRef } = setup();
    advance(400);

    expect(ambientRef.current!.intensity).toBeCloseTo(DARK_GRADES[0].ambient, 3);
    expect(keyLightRef.current!.intensity).toBeCloseTo(DARK_GRADES[0].directional, 3);
  });

  it('converges the lights onto the closing grade at the end of the arc', () => {
    const { ambientRef } = setup();
    scrollState.offset = CAMERA_ARC_END;
    advance(400);

    const last = DARK_GRADES[DARK_GRADES.length - 1];
    expect(ambientRef.current!.intensity).toBeCloseTo(last.ambient, 3);
  });

  it('opens the fog out toward the horizon on the closing chapter', () => {
    setup();
    scrollState.offset = CAMERA_ARC_END;
    advance(400);

    const fog = scene.fog as THREE.Fog;
    const last = DARK_GRADES[DARK_GRADES.length - 1];
    expect(fog.far).toBeCloseTo(last.fogFar, 2);
    expect(fog.near).toBeCloseTo(last.fogNear, 2);
  });

  it('eases rather than snapping between grades', () => {
    const { ambientRef } = setup();
    advance(400);
    const settled = ambientRef.current!.intensity;

    scrollState.offset = CAMERA_ARC_END;
    advance(1);

    const moved = Math.abs(ambientRef.current!.intensity - settled);
    const total = Math.abs(
      DARK_GRADES[DARK_GRADES.length - 1].ambient - settled
    );
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(total * 0.5);
  });

  it('uses the light grade table in the light theme', () => {
    const { ambientRef } = setup(true);
    advance(400);

    expect(ambientRef.current!.intensity).toBeCloseTo(LIGHT_GRADES[0].ambient, 3);
  });

  it('applies the grade immediately under reduced motion', () => {
    reducedMotion.mockReturnValue(true);
    const { ambientRef } = setup();

    advance(1);

    expect(ambientRef.current!.intensity).toBeCloseTo(DARK_GRADES[0].ambient, 5);
  });

  it('clamps a long frame delta so a restored tab cannot snap the grade', () => {
    const { ambientRef } = setup();
    const start = ambientRef.current!.intensity;

    frameCallback?.({}, 30);
    const jumped = Math.abs(ambientRef.current!.intensity - start);

    ambientRef.current!.intensity = start;
    frameCallback?.({}, 0.1);
    const clamped = Math.abs(ambientRef.current!.intensity - start);

    expect(jumped).toBeCloseTo(clamped, 6);
  });

  it('leaves a non-linear fog alone rather than mangling it', () => {
    scene.fog = new THREE.FogExp2('#001a1a', 0.02);
    setup();
    expect(() => advance(5)).not.toThrow();
    expect((scene.fog as THREE.FogExp2).density).toBe(0.02);
  });

  it('tolerates lights that have not attached yet', () => {
    const ambientRef = createRef<THREE.AmbientLight>();
    const keyLightRef = createRef<THREE.DirectionalLight>();
    render(
      <ChapterGrading isLight={false} ambientRef={ambientRef} keyLightRef={keyLightRef} />
    );
    expect(() => advance(3)).not.toThrow();
  });
});
