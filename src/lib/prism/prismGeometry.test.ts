import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PrismStrandGeometry, PRISM_SEGMENTS, samplePrismStrand, prismPose } from './prismGeometry';

describe('the actual prism strand geometry', () => {
  it('starts as the same straight twelve-unit core and keeps capped ends separate', () => {
    const points = new Float64Array((PRISM_SEGMENTS + 1) * 3);
    samplePrismStrand(0, points);
    expect(points[0]).toBe(0);
    expect(points[1]).toBe(-6);
    expect(points.at(-2)).toBe(6);
    for (let i = 0; i < points.length; i += 3) {
      expect(points[i]).toBe(0); expect(points[i + 2]).toBe(0);
    }
    samplePrismStrand(1, points);
    expect(Math.hypot(points[0] - points[240], points[1] - points[241], points[2] - points[242]))
      .toBeGreaterThan(3);
  });

  it('fits one solid and one sparse line draw inside the fixed budget', () => {
    const strand = new PrismStrandGeometry();
    expect(strand.body.index!.count / 3).toBe(644);
    expect(strand.cage.index!.count / 2).toBe(328);
    expect(strand.positions.byteLength + strand.surfaceNormals.byteLength + strand.cagePositions.byteLength)
      .toBeLessThan(25_000);
    strand.dispose();
  });

  it('keeps buffers stable, finite, normalized and reversibly sampled', () => {
    const strand = new PrismStrandGeometry();
    const positions = strand.body.getAttribute('position').array;
    const normals = strand.body.getAttribute('normal').array;
    let largestNormalError = 0;
    for (let step = 0; step <= 256; step++) {
      strand.update(step / 256);
      expect(strand.body.getAttribute('position').array).toBe(positions);
      expect(strand.body.getAttribute('normal').array).toBe(normals);
      expect(strand.positions.every(Number.isFinite)).toBe(true);
      for (let i = 0; i < strand.surfaceNormals.length; i += 3) {
        largestNormalError = Math.max(largestNormalError,
          Math.abs(Math.hypot(strand.surfaceNormals[i], strand.surfaceNormals[i + 1], strand.surfaceNormals[i + 2]) - 1));
      }
    }
    expect(largestNormalError).toBeLessThan(0.00005);
    strand.update(0.43);
    const before = strand.positions.slice();
    strand.update(1); strand.update(0.43);
    expect(strand.positions).toEqual(before);
    strand.dispose();
  });

  it('has outward-facing solid triangles rather than an inside-out tube', () => {
    const strand = new PrismStrandGeometry();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const normal = new THREE.Vector3(), sum = new THREE.Vector3(), scratch = new THREE.Vector3();
    const index = strand.body.index!.array;
    let minimumNormalAgreement = 1;
    for (const progress of [0, 0.2, 0.5, 0.75, 1]) {
      strand.update(progress);
      for (let i = 0; i < index.length; i += 3) {
        a.fromArray(strand.positions, index[i] * 3);
        b.fromArray(strand.positions, index[i + 1] * 3);
        c.fromArray(strand.positions, index[i + 2] * 3);
        normal.copy(b).sub(a).cross(scratch.copy(c).sub(a)).normalize();
        sum.fromArray(strand.surfaceNormals, index[i] * 3)
          .add(scratch.fromArray(strand.surfaceNormals, index[i + 1] * 3))
          .add(scratch.fromArray(strand.surfaceNormals, index[i + 2] * 3)).normalize();
        minimumNormalAgreement = Math.min(minimumNormalAgreement, normal.dot(sum));
      }
    }
    expect(minimumNormalAgreement).toBeGreaterThan(0.7);
    strand.dispose();
  });

  it('lifts the beam before bending and retraces exactly the same presentation', () => {
    const pose = { lift: 0, bend: 0 };
    prismPose(0, pose); expect(pose).toEqual({ lift: 0, bend: 0 });
    prismPose(0.28, pose); expect(pose).toEqual({ lift: 6, bend: 0 });
    prismPose(1, pose); expect(pose).toEqual({ lift: 6, bend: 1 });
    expect(() => samplePrismStrand(Infinity, new Float32Array(243))).toThrow(RangeError);
  });
});
