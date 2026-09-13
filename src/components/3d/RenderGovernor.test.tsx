import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RenderGovernor } from './RenderGovernor';
import { CinematicCameraController } from './CinematicCameraController';
import { ChapterGrading } from './ChapterGrading';
import { resetFrameGate } from '@/lib/render/frameGate';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';

const harness = vi.hoisted(() => ({
  frames: [] as { callback: (state: unknown, delta: number) => void; priority: number }[],
  state: {} as Record<string, unknown>,
  scroll: { offset: 0 },
  draw: vi.fn(),
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void, priority = 0) => {
    harness.frames.push({ callback, priority });
  },
  useThree: (selector: (state: Record<string, unknown>) => unknown) => selector(harness.state),
}));
vi.mock('@react-three/drei', () => ({ useScroll: () => harness.scroll }));
vi.mock('@/lib/gateways/animationGateway', () => ({ getPrefersReducedMotion: () => false }));

beforeEach(() => {
  resetFrameGate();
  setOverlayOcclusion(false, 'about');
  setOverlayOcclusion(false, 'education');
  harness.frames.length = 0;
  harness.draw.mockClear();
  harness.scroll.offset = 0;
});
afterEach(cleanup);

function scene(maxFps: number) {
  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#ffffff', 1, 50);
  const ambient = new THREE.AmbientLight();
  const key = new THREE.DirectionalLight();
  const clock = {
    elapsedTime: 0,
    getElapsedTime: vi.fn(() => {
      // Like THREE.Clock.getElapsedTime, this advances the shared clock.
      clock.elapsedTime += 0.002;
      return clock.elapsedTime;
    }),
  };
  harness.state = { camera, scene, clock, mouse: { x: 0, y: 0 }, gl: { render: harness.draw } };
  const mounted = render(<>
    <CinematicCameraController />
    <ChapterGrading isLight ambientRef={{ current: ambient }} keyLightRef={{ current: key }} />
    <RenderGovernor maxFps={maxFps} />
  </>);
  const frames = [...harness.frames].sort((a, b) => a.priority - b.priority);
  const tick = (frame: number) => {
    clock.elapsedTime = frame / 180;
    for (const { callback } of frames) callback(harness.state, 1 / 180);
  };
  tick(0);
  harness.scroll.offset = 0.35;
  for (let frame = 1; frame <= 180; frame++) tick(frame);
  return { ...mounted, clock, position: camera.position.clone(), ambient: ambient.intensity };
}

describe('one render decision for every producer in a frame', () => {
  it('delivers the low-tier render budget instead of letting producers consume it', () => {
    const result = scene(30);
    expect(harness.draw).toHaveBeenCalledTimes(31);
    expect(result.clock.getElapsedTime).not.toHaveBeenCalled();
  });

  it('preserves camera and light damping speed at the lower graphics draw rate', () => {
    const full = scene(0);
    full.unmount();
    resetFrameGate();
    harness.frames.length = 0;
    harness.scroll.offset = 0;
    const capped = scene(30);
    expect(capped.position.distanceTo(full.position)).toBeLessThan(0.000001);
    expect(capped.ambient).toBeCloseTo(full.ambient, 8);
  });
});
