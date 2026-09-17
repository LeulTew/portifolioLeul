import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ContactFlight, CONTACT_SKY_ORIENTATION, CONTACT_SKY_POSITION } from './contactFlight';
import { ProjectsCameraPose } from '@/lib/projects/tvScreen';

const reading = (width = 1440, height = 900) => {
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  new ProjectsCameraPose().sample(1, 1, width, height, 50, position, orientation);
  return { position, orientation };
};

describe('the single TV-to-clearing camera path', () => {
  it.each([[1280, 720], [1440, 900], [1920, 1080], [3840, 2160]])(
    'begins at the actual offset TV pose and ends in the same clearing at %ix%i', (width, height) => {
      const start = reading(width, height);
      start.position.add(new THREE.Vector3(0.12, 0.04, -0.03));
      start.orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.018));
      const flight = new ContactFlight();
      flight.depart(start.position, start.orientation);
      const position = new THREE.Vector3();
      const orientation = new THREE.Quaternion();
      flight.sample(0, position, orientation);
      expect(position.distanceTo(start.position)).toBeLessThan(1e-10);
      expect(orientation.angleTo(start.orientation)).toBeLessThan(1e-7);
      let lastHeight = position.y;
      for (let step = 1; step <= 100; step++) {
        flight.sample(step / 100, position, orientation);
        expect(position.toArray().every(Number.isFinite)).toBe(true);
        expect(position.y).toBeGreaterThanOrEqual(lastHeight);
        expect(orientation.angleTo(start.orientation)).toBeLessThan(Math.PI / 2);
        lastHeight = position.y;
      }
      expect(position.distanceTo(CONTACT_SKY_POSITION)).toBeLessThan(1e-10);
      expect(orientation.angleTo(CONTACT_SKY_ORIENTATION)).toBeLessThan(1e-7);
      expect(position.y - start.position.y).toBeGreaterThan(10);
    },
  );

  it('retraces every intermediate pose without an extra retreat or orbit', () => {
    const start = reading();
    const flight = new ContactFlight();
    flight.depart(start.position, start.orientation);
    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    const forward = Array.from({ length: 21 }, (_, step) => {
      flight.sample(step / 20, position, orientation);
      return { position: position.clone(), orientation: orientation.clone() };
    });
    flight.return(CONTACT_SKY_POSITION, CONTACT_SKY_ORIENTATION, start.position, start.orientation);
    for (let step = 20; step >= 0; step--) {
      flight.sample(step / 20, position, orientation);
      expect(position.distanceTo(forward[step].position)).toBeLessThan(1e-10);
      expect(orientation.angleTo(forward[step].orientation)).toBeLessThan(1e-7);
    }
  });

  it('captures the actual return camera and fits the current TV viewport at the other endpoint', () => {
    const actual = CONTACT_SKY_POSITION.clone().add(new THREE.Vector3(0.08, -0.02, 0.03));
    const actualRotation = CONTACT_SKY_ORIENTATION.clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.01));
    const resizedTV = reading(1280, 720);
    const flight = new ContactFlight();
    flight.return(actual, actualRotation, resizedTV.position, resizedTV.orientation);
    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    flight.sample(1, position, orientation);
    expect(position.distanceTo(actual)).toBeLessThan(1e-10);
    expect(orientation.angleTo(actualRotation)).toBeLessThan(1e-7);
    flight.sample(0, position, orientation);
    expect(position.distanceTo(resizedTV.position)).toBeLessThan(1e-10);
    expect(orientation.angleTo(resizedTV.orientation)).toBeLessThan(1e-7);
  });

  it('holds finite endpoints and rejects an invalid internal clock value', () => {
    const start = reading();
    const flight = new ContactFlight();
    flight.depart(start.position, start.orientation);
    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    flight.sample(-1, position, orientation);
    expect(position.equals(start.position)).toBe(true);
    flight.sample(2, position, orientation);
    expect(position.equals(CONTACT_SKY_POSITION)).toBe(true);
    expect(() => flight.sample(Number.NaN, position, orientation)).toThrow(RangeError);
  });
});
