import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { viewClearsPlane } from './viewClearsPlane';

const camera = (pitchDegrees: number, height = 20, fov = 50) => {
  const view = new THREE.PerspectiveCamera(fov, 1.6, 0.1, 2000);
  view.position.set(0, height, 0);
  view.rotation.set(THREE.MathUtils.degToRad(pitchDegrees), 0, 0);
  view.updateMatrixWorld(true);
  view.updateProjectionMatrix();
  return view;
};

describe('whether a view clears a horizontal plane', () => {
  it('clears the sea when every edge of the view points above the horizon', () => {
    // The vertical half-angle is 25 degrees: a 30 degree climb keeps the lowest edge 5 degrees up.
    expect(viewClearsPlane(camera(30), -4)).toBe(true);
  });

  it('sees the plane as soon as the lowest edge of the view dips under it', () => {
    expect(viewClearsPlane(camera(20), -4)).toBe(false);
    expect(viewClearsPlane(camera(0), -4)).toBe(false);
    expect(viewClearsPlane(camera(-30), -4)).toBe(false);
  });

  it('sees a plane the camera itself sits under, whatever it looks at', () => {
    expect(viewClearsPlane(camera(60, -10), -4)).toBe(false);
  });
});
