import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TVScreenProjection } from './TVScreenProjection';
import { ProjectsCameraPose, fitTVScreen } from '@/lib/projects/tvScreen';
import { registerProjectsSurface, setProjectsView } from '@/lib/projects/projectsScene';
import { resetFrameGate, setFrameBudget } from '@/lib/render/frameGate';
import { resetCameraHold } from '@/lib/camera/cameraHold';

interface Frame {
  camera: THREE.PerspectiveCamera;
  size: { width: number; height: number };
  clock: { elapsedTime: number };
}
let callback: ((state: Frame) => void) | null = null;
let priority: number | undefined;
vi.mock('@react-three/fiber', () => ({
  useFrame: (frame: (state: Frame) => void, order: number) => { callback = frame; priority = order; },
}));
let unregister: () => void;
let surface: HTMLDivElement;
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);

beforeEach(() => {
  resetCameraHold();
  resetFrameGate();
  setProjectsView(true, 1, 1);
  new ProjectsCameraPose().sample(1, 1, 1920, 1080, 50, camera.position, camera.quaternion);
  surface = document.createElement('div');
  document.body.append(surface);
  unregister = registerProjectsSurface(surface);
});
afterEach(() => {
  cleanup();
  unregister();
  surface.remove();
  setProjectsView(false, 0, 0);
  resetFrameGate();
  vi.restoreAllMocks();
});
const frame = (time: number) => callback?.({
  camera, size: { width: 1920, height: 1080 }, clock: { elapsedTime: time },
});

it('projects after the camera and before the existing single render', () => {
  render(<TVScreenProjection />);
  expect(priority).toBe(0.5);
  frame(1);
  expect(surface.style.transform).toMatch(/^matrix3d\(/);
  expect(Number.parseFloat(surface.style.width)).toBeCloseTo(fitTVScreen(1920, 1080).width);
  expect(surface.style.opacity).toBe('1');
  expect(surface).toHaveAttribute('data-frame', 'full');
});

it('publishes a tight frame so the reader chrome yields the corner band with the cabinet', () => {
  render(<TVScreenProjection />);
  const short = new THREE.PerspectiveCamera(50, 1366 / 650, 0.1, 1000);
  new ProjectsCameraPose().sample(1, 1, 1366, 650, 50, short.position, short.quaternion);
  callback?.({ camera: short, size: { width: 1366, height: 650 }, clock: { elapsedTime: 1 } });
  expect(surface).toHaveAttribute('data-frame', 'tight');
  expect(Number.parseFloat(surface.style.width)).toBeCloseTo(fitTVScreen(1366, 650).width);
});

it('writes nothing while the reader and camera are idle', () => {
  render(<TVScreenProjection />);
  frame(1);
  const write = vi.spyOn(surface.style, 'setProperty');
  for (let i = 1; i <= 120; i++) frame(1 + i / 60);
  expect(write).not.toHaveBeenCalled();
});

it('obeys the low-tier draw budget and does not project skipped frames', () => {
  setFrameBudget(1 / 30);
  render(<TVScreenProjection />);
  frame(1);
  setProjectsView(true, 1, 0.5);
  frame(1.01);
  expect(surface.style.opacity).toBe('1');
  frame(1.034);
  expect(Number(surface.style.opacity)).toBeLessThan(1);
});

it('does no screen work while its chapter is outside', () => {
  setProjectsView(false, 0, 0);
  render(<TVScreenProjection />);
  const write = vi.spyOn(surface.style, 'setProperty');
  frame(1);
  expect(write).not.toHaveBeenCalled();
});

it('paints a fresh visit even when it returns to the identical parked camera pose', () => {
  render(<TVScreenProjection />);
  frame(1);
  setProjectsView(false, 1, 1);
  surface.style.opacity = '0';
  setProjectsView(true, 1, 1);
  frame(2);
  expect(surface.style.opacity).toBe('1');
});
