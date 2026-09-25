import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { RenderGovernor } from './RenderGovernor';
import { CinematicCameraController } from './CinematicCameraController';
import { ChapterGrading } from './ChapterGrading';
import { resetFrameGate } from '@/lib/render/frameGate';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { parkContactSky, releaseContactSky } from '@/lib/contact/contactScene';

const harness = vi.hoisted(() => ({
  frames: [] as { callback: (state: unknown, delta: number) => void; priority: number }[],
  state: {} as Record<string, unknown>,
  scroll: { offset: 0 },
  draw: vi.fn(),
  canvas: null as unknown as HTMLCanvasElement,
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
  harness.canvas = document.createElement('canvas');
});
afterEach(() => {
  cleanup();
  releaseContactSky();
});

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
  harness.state = {
    camera, scene, clock, mouse: { x: 0, y: 0 }, gl: { render: harness.draw, domElement: harness.canvas },
    viewport: { dpr: 1 },
  };
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
  it('publishes the rate and quality level the world is drawing at', () => {
    const { rerender } = scene(60);
    expect(harness.canvas.dataset).toMatchObject({ worldRate: '60', worldQuality: '0' });
    rerender(<RenderGovernor maxFps={30} quality={1} />);
    expect(harness.canvas.dataset).toMatchObject({ worldRate: '30', worldQuality: '1' });
  });
  it('draws at 60fps on a high-refresh display while native callbacks keep running', () => {
    const result = scene(60);
    expect(harness.draw).toHaveBeenCalledTimes(61);
    expect(result.clock.elapsedTime).toBe(1);
    expect(result.clock.getElapsedTime).not.toHaveBeenCalled();
  });

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

  it('also preserves camera and light damping at the high-tier redraw ceiling', () => {
    const full = scene(0);
    full.unmount();
    harness.frames.length = 0;
    harness.scroll.offset = 0;
    const capped = scene(60);
    expect(capped.position.distanceTo(full.position)).toBeLessThan(0.000001);
    expect(capped.ambient).toBeCloseTo(full.ambient, 8);
  });
});

describe('a still world at parked Contact', () => {
  it('keeps its last image until a new pixel ratio clears the canvas', () => {
    const { clock, rerender } = scene(60);
    const frames = [...harness.frames].sort((a, b) => a.priority - b.priority);
    const tick = (seconds: number) => {
      clock.elapsedTime = seconds;
      for (const { callback } of frames) callback(harness.state, 1 / 60);
    };
    parkContactSky();
    for (let frame = 0; frame < 120; frame++) tick(2 + frame / 60);
    harness.draw.mockClear();
    tick(4);
    expect(harness.draw).not.toHaveBeenCalled();
    harness.state = { ...harness.state, viewport: { dpr: 2 } };
    rerender(<RenderGovernor maxFps={60} />);
    tick(4.5);
    expect(harness.draw).toHaveBeenCalledOnce();
  });
  it.each([
    ['a resize', () => window.dispatchEvent(new Event('resize'))],
    ['a theme change', async () => {
      document.documentElement.setAttribute('data-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      await new Promise(resolve => setTimeout(resolve, 0));
    }],
    ['a returning tab', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['a restored context', () => harness.canvas.dispatchEvent(new Event('webglcontextrestored'))],
  ])('keeps its last image until %s asks for a new one', async (_label, change) => {
    const { clock } = scene(60);
    const frames = [...harness.frames].sort((a, b) => a.priority - b.priority);
    const tick = (seconds: number) => {
      clock.elapsedTime = seconds;
      for (const { callback } of frames) callback(harness.state, 1 / 60);
    };
    parkContactSky();
    for (let frame = 0; frame < 120; frame++) tick(2 + frame / 60);
    harness.draw.mockClear();
    for (let frame = 0; frame < 60; frame++) tick(4 + frame / 60);
    expect(harness.draw).not.toHaveBeenCalled();
    await change();
    tick(5);
    expect(harness.draw).toHaveBeenCalledOnce();
  });
});
