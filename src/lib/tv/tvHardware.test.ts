import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  dispatchTVHardware, registerTVHardware, TV_CONTROLS, TV_CONTROL_IDS,
  TV_HARDWARE_MOTION, TVHardwareMotion,
} from './tvHardware';
import { fitTVScreen, ProjectsCameraPose, TV_SCREEN_WORLD } from '../projects/tvScreen';

describe('TV hardware contract', () => {
  it('retains ordered fixed anchors with disjoint 48px targets at the compact floor', () => {
    expect(TV_CONTROL_IDS).toEqual(['previous', 'next', 'power']);
    const pixelsPerUnit = fitTVScreen(900, 560).width / 0.55;
    expect(pixelsPerUnit).toBeCloseTo(712.14, 1);
    TV_CONTROL_IDS.forEach((id, index) => {
      const control = TV_CONTROLS[id];
      expect(control.position).toBe(control.center);
      expect(control.center[2]).toBe(0.045);
      expect(control.width * pixelsPerUnit).toBeGreaterThan(39);
      if (index === 0) return;
      const previous = TV_CONTROLS[TV_CONTROL_IDS[index - 1]];
      const separation = (control.center[0] - previous.center[0]) * pixelsPerUnit;
      expect(separation).toBeGreaterThanOrEqual(48);
    });
    expect(TV_CONTROL_IDS.map(id => TV_CONTROLS[id].position)).toEqual([
      [-0.25, -0.215, 0.045], [0, -0.215, 0.045], [0.27, -0.215, 0.045],
    ]);
  });

  it.each([[900, 560], [900, 900], [1440, 900], [3840, 2160]])(
    'keeps 48px targets plus a 2px gap in the actual framed broadcast pose at %ix%i', (width, height) => {
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      new ProjectsCameraPose().sample(1, 0, width, height, 50, camera.position, camera.quaternion);
      camera.updateMatrixWorld(true);
      const centers = TV_CONTROL_IDS.map(id => new THREE.Vector3(...TV_CONTROLS[id].position)
        .applyMatrix4(TV_SCREEN_WORLD).project(camera).x * width / 2 + width / 2);
      expect(centers[1] - centers[0]).toBeGreaterThanOrEqual(50);
      expect(centers[2] - centers[1]).toBeGreaterThanOrEqual(50);
    },
  );

  it('only forwards physical feedback to live registered hardware', () => {
    const first = vi.fn();
    const second = vi.fn();
    const removeFirst = registerTVHardware(first);
    const removeSecond = registerTVHardware(second);
    try {
      dispatchTVHardware('previous', 'press', true);
      dispatchTVHardware('power', 'focus', true);
      dispatchTVHardware('next', 'hover', false);
      expect(first.mock.calls).toEqual(second.mock.calls);
      expect(first).toHaveBeenCalledTimes(3);
      removeFirst();
      removeFirst();
      dispatchTVHardware('previous', 'press', false);
      expect(first).toHaveBeenCalledTimes(3);
      expect(second).toHaveBeenLastCalledWith('previous', 'press', false);
    } finally {
      removeFirst();
      removeSecond();
    }
  });
});

describe('finite physical cap motion', () => {
  it('finishes a 75ms down / 50ms visible dwell / 130ms release after an instant activation', () => {
    const motion = new TVHardwareMotion(false);
    expect(motion.moving).toBe(false);
    motion.setPressed('next', true);
    motion.setPressed('next', false);
    motion.step(0.074);
    expect(motion.depth('next')).toBeLessThan(TV_HARDWARE_MOTION.pressTravel);
    motion.step(0.001);
    expect(motion.depth('next')).toBe(TV_HARDWARE_MOTION.pressTravel);
    motion.step(0.049);
    expect(motion.depth('next')).toBe(TV_HARDWARE_MOTION.pressTravel);
    motion.step(0.002);
    expect(motion.depth('next')).toBeLessThan(TV_HARDWARE_MOTION.pressTravel);
    motion.step(0.13);
    expect(motion.depth('next')).toBe(0);
    expect(motion.moving).toBe(false);
    expect(motion.step(10)).toBe(false);
  });

  it('stops doing animation work while held and returns only the released cap', () => {
    const motion = new TVHardwareMotion(false);
    motion.setPressed('previous', true);
    motion.setPressed('next', true);
    motion.step(1);
    expect(motion.moving).toBe(false);
    expect(motion.step(100)).toBe(false);
    expect(motion.depth('previous')).toBe(TV_HARDWARE_MOTION.pressTravel);
    motion.setPressed('previous', false);
    motion.step(1);
    expect(motion.depth('previous')).toBe(0);
    expect(motion.depth('next')).toBe(TV_HARDWARE_MOTION.pressTravel);
    expect(motion.depth('power')).toBe(0);
  });

  it('retargets rapid presses without crossing travel limits and restores all channels', () => {
    const motion = new TVHardwareMotion(false);
    for (let index = 0; index < 80; index++) {
      const id = TV_CONTROL_IDS[index % 3];
      motion.setPressed(id, true);
      motion.step(0.027);
      motion.setPressed(id, false);
      motion.step(0.017);
      for (const key of TV_CONTROL_IDS) {
        expect(motion.depth(key)).toBeGreaterThanOrEqual(0);
        expect(motion.depth(key)).toBeLessThanOrEqual(TV_HARDWARE_MOTION.pressTravel);
      }
    }
    motion.step(1);
    expect(TV_CONTROL_IDS.map(id => motion.depth(id))).toEqual([0, 0, 0]);
    expect(motion.moving).toBe(false);
  });

  it('latches only the power cap and restores the intended power state on hidden/unmount reset', () => {
    const motion = new TVHardwareMotion(false);
    motion.setPowered(true);
    motion.step(0.065);
    expect(motion.depth('power')).toBeGreaterThan(0);
    expect(motion.depth('power')).toBeLessThan(TV_HARDWARE_MOTION.powerLatchTravel);
    motion.setPressed('previous', true);
    motion.setPressed('power', true);
    motion.step(0.075);
    motion.reset();
    expect(TV_CONTROL_IDS.map(id => motion.depth(id)))
      .toEqual([0, 0, TV_HARDWARE_MOTION.powerLatchTravel]);
    expect(motion.moving).toBe(false);
    motion.setPowered(false);
    motion.step(1);
    expect(motion.depth('power')).toBe(0);
  });

  it('uses immediate restrained feedback without any score under reduced motion', () => {
    const motion = new TVHardwareMotion(false);
    motion.setReducedMotion(true);
    motion.setPowered(true);
    motion.setPressed('next', true);
    expect(motion.depth('next')).toBe(TV_HARDWARE_MOTION.pressTravel * 0.35);
    expect(motion.depth('power')).toBe(TV_HARDWARE_MOTION.powerLatchTravel);
    expect(motion.moving).toBe(false);
    motion.setPressed('next', false);
    expect(motion.depth('next')).toBe(0);
    motion.setReducedMotion(false);
    motion.setPressed('previous', true);
    expect(motion.moving).toBe(true);
    motion.setReducedMotion(true);
    expect(motion.depth('previous')).toBe(0);
    expect(motion.moving).toBe(false);
  });

  it('ignores nonfinite and nonpositive steps without poisoning a live score', () => {
    const motion = new TVHardwareMotion(false);
    motion.setPressed('next', true);
    for (const value of [NaN, Infinity, -1, 0]) expect(motion.step(value)).toBe(false);
    expect(motion.depth('next')).toBe(0);
    motion.step(0.075);
    expect(motion.depth('next')).toBe(TV_HARDWARE_MOTION.pressTravel);
  });
});
