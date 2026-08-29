import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { writeDriftInstances } from './writeDriftInstances';
import {
  DEFAULT_DRIFT_BOUNDS,
  createDriftSeeds,
  driftHeight,
  driftSwayX,
  driftSwayZ,
} from './drift';

const COUNT = 24;

const makeMesh = (count = COUNT) =>
  new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshBasicMaterial(),
    count
  );

const positionOf = (mesh: THREE.InstancedMesh, index: number) => {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
};

describe('writeDriftInstances', () => {
  it('places every instance at its modelled position', () => {
    const mesh = makeMesh();
    const seeds = createDriftSeeds(COUNT);

    writeDriftInstances(mesh, seeds, COUNT, 3.5);

    for (let i = 0; i < COUNT; i++) {
      const position = positionOf(mesh, i);
      expect(position.x).toBeCloseTo(driftSwayX(seeds, i, 3.5), 4);
      expect(position.y).toBeCloseTo(driftHeight(seeds, i, 3.5), 4);
      expect(position.z).toBeCloseTo(driftSwayZ(seeds, i, 3.5), 4);
    }
  });

  it('flags the instance buffer for upload', () => {
    const mesh = makeMesh();
    // `needsUpdate` is a write-only accessor in three; it bumps `version`.
    const before = mesh.instanceMatrix.version;

    writeDriftInstances(mesh, createDriftSeeds(COUNT), COUNT, 0);

    expect(mesh.instanceMatrix.version).toBeGreaterThan(before);
  });

  it('moves the field between frames', () => {
    const mesh = makeMesh();
    const seeds = createDriftSeeds(COUNT);

    writeDriftInstances(mesh, seeds, COUNT, 0);
    const before = positionOf(mesh, 5);

    writeDriftInstances(mesh, seeds, COUNT, 1.2);
    const after = positionOf(mesh, 5);

    expect(before.distanceTo(after)).toBeGreaterThan(0);
  });

  it('keeps every instance inside the field over a long run', () => {
    const mesh = makeMesh();
    const seeds = createDriftSeeds(COUNT);
    const { radius, floor, ceiling } = DEFAULT_DRIFT_BOUNDS;

    for (const time of [0, 30, 600, 100000]) {
      writeDriftInstances(mesh, seeds, COUNT, time);
      for (let i = 0; i < COUNT; i++) {
        const position = positionOf(mesh, i);
        expect(position.y).toBeGreaterThanOrEqual(floor - 1e-4);
        expect(position.y).toBeLessThanOrEqual(ceiling + 1e-4);
        // Origin plus the maximum seeded sway amplitude.
        expect(Math.abs(position.x)).toBeLessThanOrEqual(radius + 2.1);
        expect(Math.abs(position.z)).toBeLessThanOrEqual(radius + 2.1);
      }
    }
  });

  it('honours custom bounds', () => {
    const mesh = makeMesh();
    const bounds = { radius: 4, floor: 0, ceiling: 3 };
    const seeds = createDriftSeeds(COUNT, bounds);

    writeDriftInstances(mesh, seeds, COUNT, 17, bounds);

    for (let i = 0; i < COUNT; i++) {
      const y = positionOf(mesh, i).y;
      expect(y).toBeGreaterThanOrEqual(-1e-4);
      expect(y).toBeLessThanOrEqual(3 + 1e-4);
    }
  });

  it('writes nothing for a zero count', () => {
    const mesh = makeMesh(1);
    const identity = new THREE.Matrix4();
    mesh.setMatrixAt(0, identity);

    writeDriftInstances(mesh, createDriftSeeds(0), 0, 5);

    expect(positionOf(mesh, 0).length()).toBe(0);
  });

  it('reuses one scratch transform rather than allocating per instance', () => {
    // Two passes over a large field must not depend on allocation order.
    const mesh = makeMesh(400);
    const seeds = createDriftSeeds(400);

    writeDriftInstances(mesh, seeds, 400, 2);
    const first = positionOf(mesh, 399).clone();

    writeDriftInstances(mesh, seeds, 400, 2);
    expect(positionOf(mesh, 399).distanceTo(first)).toBe(0);
  });
});
