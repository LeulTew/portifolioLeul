import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { writeDriftInstances } from './writeDriftInstances';
import {
  DEFAULT_DRIFT_BOUNDS,
  MAX_SWAY_AMPLITUDE,
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

    const [cx, cy, cz] = DEFAULT_DRIFT_BOUNDS.center;
    for (let i = 0; i < COUNT; i++) {
      const position = positionOf(mesh, i);
      // Positions are world-space: the field's own centre plus the local drift.
      expect(position.x).toBeCloseTo(cx + driftSwayX(seeds, i, 3.5), 4);
      expect(position.y).toBeCloseTo(cy + driftHeight(seeds, i, 3.5), 4);
      expect(position.z).toBeCloseTo(cz + driftSwayZ(seeds, i, 3.5), 4);
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
    const { radius, floor, ceiling, center } = DEFAULT_DRIFT_BOUNDS;

    for (const time of [0, 30, 600, 100000]) {
      writeDriftInstances(mesh, seeds, COUNT, time);
      for (let i = 0; i < COUNT; i++) {
        const position = positionOf(mesh, i);
        expect(position.y).toBeGreaterThanOrEqual(center[1] + floor - 1e-4);
        expect(position.y).toBeLessThanOrEqual(center[1] + ceiling + 1e-4);
        // Centre plus the field radius and the maximum seeded sway amplitude.
        const reach = radius + MAX_SWAY_AMPLITUDE;
        expect(Math.abs(position.x - center[0])).toBeLessThanOrEqual(reach);
        expect(Math.abs(position.z - center[2])).toBeLessThanOrEqual(reach);
      }
    }
  });

  it('honours custom bounds', () => {
    const mesh = makeMesh();
    const bounds = { center: [5, 2, -9] as const, radius: 4, floor: 0, ceiling: 3 };
    const seeds = createDriftSeeds(COUNT, bounds);

    writeDriftInstances(mesh, seeds, COUNT, 17, bounds);

    for (let i = 0; i < COUNT; i++) {
      const y = positionOf(mesh, i).y;
      expect(y).toBeGreaterThanOrEqual(2 - 1e-4);
      expect(y).toBeLessThanOrEqual(5 + 1e-4);
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

  it('scales away motes that the camera passes through', () => {
    const mesh = makeMesh();
    const seeds = createDriftSeeds(COUNT);
    const [cx, cy, cz] = DEFAULT_DRIFT_BOUNDS.center;

    // Camera sitting exactly on instance 0.
    const onTop = new THREE.Vector3(
      cx + driftSwayX(seeds, 0, 0),
      cy + driftHeight(seeds, 0, 0),
      cz + driftSwayZ(seeds, 0, 0)
    );

    writeDriftInstances(mesh, seeds, COUNT, 0, DEFAULT_DRIFT_BOUNDS, onTop);

    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    expect(scale.length()).toBeCloseTo(0, 5);
  });

  it('leaves motes far from the camera at full size', () => {
    const mesh = makeMesh();
    const seeds = createDriftSeeds(COUNT);

    writeDriftInstances(
      mesh,
      seeds,
      COUNT,
      0,
      DEFAULT_DRIFT_BOUNDS,
      new THREE.Vector3(0, 5, 400)
    );

    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixScale(matrix);
    expect(scale.x).toBeCloseTo(1, 5);
  });

  it('keeps every mote at full size when no camera is supplied', () => {
    const mesh = makeMesh();
    writeDriftInstances(mesh, createDriftSeeds(COUNT), COUNT, 1);

    const matrix = new THREE.Matrix4();
    for (let i = 0; i < COUNT; i++) {
      mesh.getMatrixAt(i, matrix);
      expect(new THREE.Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1, 5);
    }
  });
});
