import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TVParallax, TV_PARALLAX_MAX_OFFSET } from './tvParallax';

describe('readable-TV pointer response', () => {
  it('is bounded and becomes a still pose when the pointer stops', () => {
    const tilt = new TVParallax();
    const camera = new THREE.PerspectiveCamera();
    const base = new THREE.Vector3(0, 0, 6);
    for (let frame = 0; frame < 240; frame++) {
      camera.position.copy(base);
      camera.quaternion.identity();
      tilt.apply(camera.position, camera.quaternion, 1, 1, true, true, 1, 1 / 60);
    }
    expect(camera.position.distanceTo(base)).toBeLessThan(TV_PARALLAX_MAX_OFFSET * 1.15);
    expect(camera.position.x).toBeCloseTo(TV_PARALLAX_MAX_OFFSET, 5);
    expect(camera.position.y).toBeCloseTo(TV_PARALLAX_MAX_OFFSET * 0.55, 5);
  });

  it('starts departure at the actual offset pose and yields continuously to the authored beat', () => {
    const tilt = new TVParallax();
    const position = new THREE.Vector3(0, 0, 6);
    const orientation = new THREE.Quaternion();
    tilt.apply(position, orientation, 0.8, -0.5, true, true, 1, 0.1);
    const heldPosition = position.clone();
    const heldOrientation = orientation.clone();
    position.set(0, 0, 6);
    orientation.identity();
    tilt.apply(position, orientation, 0.8, -0.5, false, true, 1, 1 / 60);
    expect(position.distanceTo(heldPosition)).toBeLessThan(1e-9);
    expect(orientation.angleTo(heldOrientation)).toBeLessThan(1e-7);
    position.set(0, 0, 6);
    orientation.identity();
    tilt.apply(position, orientation, 0.8, -0.5, false, true, 0.86, 1 / 60);
    expect(position.distanceTo(new THREE.Vector3(0, 0, 6))).toBeCloseTo(
      heldPosition.distanceTo(new THREE.Vector3(0, 0, 6)) / 2, 6,
    );
    position.set(0, 0, 6);
    orientation.identity();
    tilt.apply(position, orientation, 0.8, -0.5, false, true, 0.7, 1 / 60);
    expect(position.toArray()).toEqual([0, 0, 6]);
    expect(orientation.toArray()).toEqual([0, 0, 0, 1]);
  });

  it('is absent for low tier, reduced motion and coarse pointers and resets between visits', () => {
    const tilt = new TVParallax();
    const position = new THREE.Vector3(0, 0, 6);
    const orientation = new THREE.Quaternion();
    tilt.apply(position, orientation, 1, 1, true, false, 1, 0.1);
    expect(position.toArray()).toEqual([0, 0, 6]);
    tilt.apply(position, orientation, 1, 1, true, true, 1, 0.1);
    expect(position.x).toBeGreaterThan(0);
    tilt.reset();
    position.set(0, 0, 6);
    orientation.identity();
    tilt.apply(position, orientation, 0, 0, true, true, 1, 0.1);
    expect(position.toArray()).toEqual([0, 0, 6]);
  });
});
