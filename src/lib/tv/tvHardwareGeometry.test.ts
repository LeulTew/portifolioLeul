import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TvHardwareGeometry, TV_HARDWARE_BUDGET, TV_CONTROL_WELL } from './tvHardwareGeometry';
import { TV_CONTROLS, TV_CONTROL_IDS, TV_HARDWARE_MOTION } from './tvHardware';
import {
  CrtHousingGeometry, CRT_HOUSING_PARTS, CRT_SPEAKER_RIB_POSITIONS,
} from '../projects/crtHousingGeometry';
import {
  CrtSpeakerCabinetGeometry, CRT_SPEAKER_CABINET_PARTS,
} from '../projects/crtSpeakerCabinetGeometry';
import { TV_SCREEN_WORLD } from '../projects/tvScreen';

let geometry: TvHardwareGeometry;
beforeEach(() => { geometry = new TvHardwareGeometry(); });
afterEach(() => { geometry.dispose(); });

describe('the one-draw mechanical control batch', () => {
  it('has finite indexed surfaces, flat face normals, and no degenerate engraving triangles', () => {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex()!;
    expect(position.count).toBe(452);
    expect(index.count / 3).toBe(476);
    expect(geometry.groups).toHaveLength(0);
    expect((position as THREE.BufferAttribute).usage).toBe(THREE.DynamicDrawUsage);
    for (const attribute of [position, normal, color]) {
      expect([...attribute.array].every(Number.isFinite)).toBe(true);
    }
    for (let vertex = 0; vertex < position.count; vertex++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex);
      expect(geometry.boundingBox!.containsPoint(point)).toBe(true);
      expect(new THREE.Vector3().fromBufferAttribute(normal, vertex).length()).toBeCloseTo(1, 5);
      expect(point.y).toBeLessThan(-0.16);
    }
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const vertices = [0, 1, 2].map(corner => index.getX(triangle + corner));
      expect(vertices.every(vertex => Number.isInteger(vertex) && vertex >= 0 && vertex < position.count))
        .toBe(true);
      const [a, b, c] = vertices.map(vertex => new THREE.Vector3().fromBufferAttribute(position, vertex));
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-22);
    }
  });

  it('moves each cap and engraving independently without changing XY, normals or other caps', () => {
    const original = geometry.getAttribute('position').array.slice();
    const normal = geometry.getAttribute('normal').array.slice();
    const color = geometry.getAttribute('color').array.slice();
    for (const id of TV_CONTROL_IDS) {
      const { start, count, indexStart, indexCount } = geometry.capRanges[id];
      expect(count).toBeGreaterThan(100);
      const depth = TV_HARDWARE_MOTION.pressTravel;
      expect(geometry.setDepth(id, depth)).toBe(true);
      const position = geometry.getAttribute('position');
      const index = geometry.getIndex()!;
      for (let vertex = 0; vertex < position.count; vertex++) {
        const moving = vertex >= start && vertex < start + count;
        expect(position.getX(vertex)).toBe(original[vertex * 3]);
        expect(position.getY(vertex)).toBe(original[vertex * 3 + 1]);
        expect(position.getZ(vertex)).toBeCloseTo(original[vertex * 3 + 2] - (moving ? depth : 0), 7);
      }
      for (let i = indexStart; i < indexStart + indexCount; i++) {
        expect(index.getX(i)).toBeGreaterThanOrEqual(start);
        expect(index.getX(i)).toBeLessThan(start + count);
      }
      expect(geometry.getAttribute('normal').array).toEqual(normal);
      expect(geometry.getAttribute('color').array).toEqual(color);
      geometry.restore();
      expect(geometry.getAttribute('position').array).toEqual(original);
    }
  });

  it('keeps the full power travel inside the unchanged envelope and clear of the well floor', () => {
    geometry.setDepth('power', TV_HARDWARE_MOTION.pressTravel + TV_HARDWARE_MOTION.powerLatchTravel);
    const position = geometry.getAttribute('position');
    const { start, count } = geometry.capRanges.power;
    for (let vertex = start; vertex < start + count; vertex++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex);
      expect(point.z).toBeGreaterThan(TV_CONTROL_WELL.floorZ);
      expect(geometry.boundingBox!.containsPoint(point)).toBe(true);
      expect(geometry.boundingSphere!.containsPoint(point)).toBe(true);
    }
    geometry.restore(true);
    const maximum = Math.max(...Array.from({ length: count }, (_, index) => position.getZ(start + index)));
    expect(maximum).toBeCloseTo(0.046 - TV_HARDWARE_MOTION.powerLatchTravel, 7);
    expect(TV_CONTROLS.power.center).toEqual([0.27, -0.215, 0.045]);
  });

  it('submits exactly 2520 complete-TV triangles in eleven main draws including the lower cabinet and screen', () => {
    let triangles = geometry.getIndex()!.count / 3;
    let draws = TV_HARDWARE_BUDGET.drawCalls;
    for (const part of CRT_HOUSING_PARTS) {
      const owned = new CrtHousingGeometry(part);
      triangles += owned.getIndex()!.count / 3 * (part === 'speakerRib' ? CRT_SPEAKER_RIB_POSITIONS.length : 1);
      draws++;
      owned.dispose();
    }
    let lowerTriangles = 0;
    for (const part of CRT_SPEAKER_CABINET_PARTS) {
      const owned = new CrtSpeakerCabinetGeometry(part, TV_SCREEN_WORLD);
      lowerTriangles += owned.getIndex()!.count / 3;
      draws++;
      owned.dispose();
    }
    expect(lowerTriangles).toBe(264);
    triangles += lowerTriangles + 2;
    draws++;
    expect(triangles).toBe(2520);
    expect(draws).toBe(11);
    expect(triangles).toBeLessThanOrEqual(TV_HARDWARE_BUDGET.maxCompleteTVTriangles);
    expect(draws).toBeLessThanOrEqual(TV_HARDWARE_BUDGET.maxCompleteTVDrawCalls);
    expect(geometry.getIndex()!.count / 3).toBeLessThanOrEqual(TV_HARDWARE_BUDGET.maxSubmittedTriangles);
  });

  it('skips unchanged uploads, clamps invalid travel, and owns no shared cached buffers', () => {
    const second = new TvHardwareGeometry();
    const secondDisposed = vi.fn();
    second.addEventListener('dispose', secondDisposed);
    try {
      expect(geometry.getAttribute('position').array).not.toBe(second.getAttribute('position').array);
      expect(geometry.getIndex()!.array).not.toBe(second.getIndex()!.array);
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const version = position.version;
      expect(geometry.setDepth('previous', 0)).toBe(false);
      expect(position.version).toBe(version);
      geometry.setDepth('previous', 100);
      expect([...position.array].every(Number.isFinite)).toBe(true);
      geometry.setDepth('previous', NaN);
      expect(position.array).toEqual(second.getAttribute('position').array);
      geometry.dispose();
      expect(secondDisposed).not.toHaveBeenCalled();
    } finally {
      second.dispose();
    }
  });
});
