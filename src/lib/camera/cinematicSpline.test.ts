import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CAMERA_ARC_END,
  CAMERA_CHAPTERS,
  createCameraSpline,
  mapScrollToArc,
  nearestChapterIndex,
  sampleCameraPose,
  sampleChapterPose,
} from './cinematicSpline';

describe('CAMERA_CHAPTERS', () => {
  it('covers every scrolled section anchor in document order', () => {
    expect(CAMERA_CHAPTERS.map((c) => c.id)).toEqual([
      'home',
      'about',
      'skills',
      'projects',
      'contact',
    ]);
  });

  it('never places the camera below the ocean plane at y = -4', () => {
    for (const chapter of CAMERA_CHAPTERS) {
      expect(chapter.position[1]).toBeGreaterThan(-4);
    }
  });

  it('always frames a point in front of the camera, not behind it', () => {
    for (const chapter of CAMERA_CHAPTERS) {
      expect(chapter.target[2]).toBeLessThan(chapter.position[2]);
    }
  });

  it('completes the arc before the page runs out of scroll', () => {
    expect(CAMERA_ARC_END).toBeGreaterThan(0);
    expect(CAMERA_ARC_END).toBeLessThan(1);
  });
});

describe('mapScrollToArc', () => {
  it('starts the arc at the top of the page', () => {
    expect(mapScrollToArc(0)).toBe(0);
  });

  it('rescales scroll onto the arc range', () => {
    expect(mapScrollToArc(0.25, 0.5)).toBe(0.5);
  });

  it('completes the arc exactly at arcEnd', () => {
    expect(mapScrollToArc(0.5, 0.5)).toBe(1);
  });

  it('holds the final shot for all scroll past arcEnd', () => {
    // This is what lets the DOM keep scrolling after the 3D travel finishes.
    expect(mapScrollToArc(0.75, 0.5)).toBe(1);
    expect(mapScrollToArc(1, 0.5)).toBe(1);
  });

  it('clamps negative and non-finite scroll to the start', () => {
    expect(mapScrollToArc(-1)).toBe(0);
    expect(mapScrollToArc(Number.NaN)).toBe(0);
  });

  it('treats a zero-length arc as already complete', () => {
    expect(mapScrollToArc(0.5, 0)).toBe(1);
  });
});

describe('nearestChapterIndex', () => {
  it('snaps to the first chapter at the start', () => {
    expect(nearestChapterIndex(0)).toBe(0);
  });

  it('snaps to the last chapter at the end', () => {
    expect(nearestChapterIndex(1)).toBe(CAMERA_CHAPTERS.length - 1);
  });

  it('snaps to the closest interior chapter', () => {
    expect(nearestChapterIndex(0.5, 5)).toBe(2);
    expect(nearestChapterIndex(0.26, 5)).toBe(1);
  });

  it('clamps out-of-range and non-finite progress', () => {
    expect(nearestChapterIndex(-2)).toBe(0);
    expect(nearestChapterIndex(9)).toBe(CAMERA_CHAPTERS.length - 1);
    expect(nearestChapterIndex(Number.NaN)).toBe(0);
  });

  it('handles a single-chapter list without going negative', () => {
    expect(nearestChapterIndex(1, 1)).toBe(0);
  });
});

describe('createCameraSpline', () => {
  it('rejects a spline that cannot be interpolated', () => {
    expect(() => createCameraSpline([CAMERA_CHAPTERS[0]])).toThrow(
      /at least two chapters/
    );
  });

  it('builds open curves through every authored chapter', () => {
    const spline = createCameraSpline();
    expect(spline.positionCurve.points).toHaveLength(CAMERA_CHAPTERS.length);
    expect(spline.targetCurve.points).toHaveLength(CAMERA_CHAPTERS.length);
    expect(spline.positionCurve.closed).toBe(false);
  });
});

describe('sampleCameraPose', () => {
  const spline = createCameraSpline();
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();

  it('lands on the first authored shot at t = 0', () => {
    sampleCameraPose(spline, 0, position, target);
    expect(position.toArray()).toEqual([...CAMERA_CHAPTERS[0].position]);
    expect(target.toArray()).toEqual([...CAMERA_CHAPTERS[0].target]);
  });

  it('lands on the last authored shot at t = 1', () => {
    sampleCameraPose(spline, 1, position, target);
    const last = CAMERA_CHAPTERS[CAMERA_CHAPTERS.length - 1];
    expect(position.x).toBeCloseTo(last.position[0], 5);
    expect(position.y).toBeCloseTo(last.position[1], 5);
    expect(position.z).toBeCloseTo(last.position[2], 5);
  });

  it('clamps out-of-range progress instead of extrapolating off the curve', () => {
    const overrun = new THREE.Vector3();
    const overrunTarget = new THREE.Vector3();
    sampleCameraPose(spline, 4, overrun, overrunTarget);
    sampleCameraPose(spline, 1, position, target);
    expect(overrun.distanceTo(position)).toBeCloseTo(0, 5);
  });

  it('treats non-finite progress as the start of the arc', () => {
    sampleCameraPose(spline, Number.NaN, position, target);
    expect(position.toArray()).toEqual([...CAMERA_CHAPTERS[0].position]);
  });

  it('writes into the caller vectors rather than allocating', () => {
    const reused = new THREE.Vector3();
    const reusedTarget = new THREE.Vector3();
    sampleCameraPose(spline, 0.4, reused, reusedTarget);
    const identity = reused;
    sampleCameraPose(spline, 0.8, reused, reusedTarget);
    expect(reused).toBe(identity);
  });

  it('moves the viewpoint continuously across the arc', () => {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const scratch = new THREE.Vector3();

    sampleCameraPose(spline, 0.3, a, scratch);
    sampleCameraPose(spline, 0.31, b, scratch);

    expect(a.distanceTo(b)).toBeGreaterThan(0);
    expect(a.distanceTo(b)).toBeLessThan(5);
  });
});

describe('sampleChapterPose', () => {
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();

  it('returns the exact authored shot for a chapter', () => {
    sampleChapterPose(3, position, target);
    expect(position.toArray()).toEqual([...CAMERA_CHAPTERS[3].position]);
    expect(target.toArray()).toEqual([...CAMERA_CHAPTERS[3].target]);
  });

  it('clamps indices outside the chapter list', () => {
    sampleChapterPose(-5, position, target);
    expect(position.toArray()).toEqual([...CAMERA_CHAPTERS[0].position]);

    sampleChapterPose(99, position, target);
    const last = CAMERA_CHAPTERS[CAMERA_CHAPTERS.length - 1];
    expect(position.toArray()).toEqual([...last.position]);
  });
});
