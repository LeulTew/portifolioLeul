import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';
import {
  DARK_GRADES,
  LIGHT_GRADES,
  createGradeTarget,
  resolveGradeSpan,
  sampleGrade,
  type ChapterGrade,
} from './chapterGrade';

describe('grade tables', () => {
  it('carry one grade per camera chapter in both themes', () => {
    expect(DARK_GRADES).toHaveLength(CAMERA_CHAPTERS.length);
    expect(LIGHT_GRADES).toHaveLength(CAMERA_CHAPTERS.length);
  });

  it('always place the fog start in front of the fog end', () => {
    for (const grade of [...DARK_GRADES, ...LIGHT_GRADES]) {
      expect(grade.fogNear).toBeLessThan(grade.fogFar);
    }
  });

  it('keep light intensities positive', () => {
    for (const grade of [...DARK_GRADES, ...LIGHT_GRADES]) {
      expect(grade.ambient).toBeGreaterThan(0);
      expect(grade.directional).toBeGreaterThan(0);
    }
  });

  it('stay restrained rather than swinging across chapters', () => {
    // The scrims hide the world wherever there is copy, so a large swing would
    // only draw attention to the mechanism.
    const ambients = DARK_GRADES.map((g) => g.ambient);
    const spread = Math.max(...ambients) - Math.min(...ambients);
    expect(spread).toBeLessThan(0.2);
  });

  it('light the scene more brightly in the light theme', () => {
    for (let i = 0; i < DARK_GRADES.length; i++) {
      expect(LIGHT_GRADES[i].ambient).toBeGreaterThan(DARK_GRADES[i].ambient);
      expect(LIGHT_GRADES[i].directional).toBeGreaterThan(DARK_GRADES[i].directional);
    }
  });
});

describe('resolveGradeSpan', () => {
  it('starts on the first pair at the top of the arc', () => {
    expect(resolveGradeSpan(0, 5)).toEqual({ from: 0, to: 1, mix: 0 });
  });

  it('ends on the last pair fully blended', () => {
    expect(resolveGradeSpan(1, 5)).toEqual({ from: 3, to: 4, mix: 1 });
  });

  it('lands exactly on an interior chapter boundary', () => {
    expect(resolveGradeSpan(0.5, 5)).toEqual({ from: 2, to: 3, mix: 0 });
  });

  it('reports the blend between two chapters', () => {
    const span = resolveGradeSpan(0.375, 5);
    expect(span.from).toBe(1);
    expect(span.to).toBe(2);
    expect(span.mix).toBeCloseTo(0.5, 5);
  });

  it('clamps out-of-range and non-finite progress', () => {
    expect(resolveGradeSpan(-3, 5)).toEqual({ from: 0, to: 1, mix: 0 });
    expect(resolveGradeSpan(9, 5)).toEqual({ from: 3, to: 4, mix: 1 });
    expect(resolveGradeSpan(Number.NaN, 5)).toEqual({ from: 0, to: 1, mix: 0 });
  });

  it('degenerates safely for a single chapter', () => {
    expect(resolveGradeSpan(0.5, 1)).toEqual({ from: 0, to: 0, mix: 0 });
  });
});

describe('sampleGrade', () => {
  it('reproduces the first grade exactly at the start of the arc', () => {
    const out = createGradeTarget();
    sampleGrade(DARK_GRADES, 0, out);

    expect(out.ambient).toBeCloseTo(DARK_GRADES[0].ambient, 6);
    expect(out.fogFar).toBeCloseTo(DARK_GRADES[0].fogFar, 6);
    expect(out.fogColor.getHexString()).toBe(DARK_GRADES[0].fogColor.getHexString());
  });

  it('reproduces the last grade exactly at the end of the arc', () => {
    const out = createGradeTarget();
    const last = DARK_GRADES[DARK_GRADES.length - 1];
    sampleGrade(DARK_GRADES, 1, out);

    expect(out.ambient).toBeCloseTo(last.ambient, 6);
    expect(out.keyColor.getHexString()).toBe(last.keyColor.getHexString());
  });

  it('blends halfway between two adjacent chapters', () => {
    const out = createGradeTarget();
    sampleGrade(DARK_GRADES, 0.125, out);

    const expected = (DARK_GRADES[0].ambient + DARK_GRADES[1].ambient) / 2;
    expect(out.ambient).toBeCloseTo(expected, 6);
  });

  it('writes into the caller target rather than allocating', () => {
    const out = createGradeTarget();
    const fogColor = out.fogColor;

    sampleGrade(DARK_GRADES, 0.3, out);
    sampleGrade(DARK_GRADES, 0.7, out);

    expect(out.fogColor).toBe(fogColor);
  });

  it('keeps fog ordered at every point along the arc', () => {
    const out = createGradeTarget();
    for (let t = 0; t <= 1; t += 0.01) {
      sampleGrade(DARK_GRADES, t, out);
      expect(out.fogNear).toBeLessThan(out.fogFar);
    }
  });

  it('leaves the target untouched for an empty table', () => {
    const out = createGradeTarget();
    out.ambient = 0.42;
    sampleGrade([], 0.5, out);
    expect(out.ambient).toBe(0.42);
  });

  it('holds a single-entry table constant across the arc', () => {
    const only: ChapterGrade[] = [
      {
        ambient: 0.3,
        directional: 0.7,
        fogNear: 10,
        fogFar: 40,
        fogColor: new THREE.Color('#123456'),
        keyColor: new THREE.Color('#abcdef'),
      },
    ];
    const out = createGradeTarget();

    sampleGrade(only, 0.9, out);

    expect(out.ambient).toBe(0.3);
    expect(out.fogColor.getHexString()).toBe('123456');
  });
});
