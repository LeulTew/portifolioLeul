import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CAMERA_ARC_END,
  CAMERA_CHAPTERS,
  CLOSING_SHOT,
  createCameraSpline,
  mapScrollToArc,
  nearestChapterIndex,
  sampleCameraPose,
  sampleChapterPose,
} from './cinematicSpline';
import { NO_HOLD } from './holdRange';

describe('CLOSING_SHOT', () => {
  it('reproduces the composition the scene had before the camera used a spline', () => {
    // Previously the camera sat at [0, 5, 30] looking at the origin while the
    // world rotated by scrollProgress * PI, so the arc ended a half turn round.
    // That is the same view as the camera at R(-180) * [0, 5, 30] over a fixed
    // world -- the shot that brings the television around to face the viewer.
    expect(CLOSING_SHOT.position).toEqual([0, 5, -30]);
    expect(CLOSING_SHOT.target).toEqual([0, 0, 0]);
  });

  it('is where the arc comes to rest', () => {
    expect(CAMERA_CHAPTERS[CAMERA_CHAPTERS.length - 1]).toBe(CLOSING_SHOT);
  });
});

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

  it('never frames the point the camera is standing on', () => {
    for (const chapter of CAMERA_CHAPTERS) {
      const [px, py, pz] = chapter.position;
      const [tx, ty, tz] = chapter.target;
      const distance = Math.hypot(px - tx, py - ty, pz - tz);
      expect(distance).toBeGreaterThan(1);
    }
  });

  it('holds a consistent orbit radius around the island', () => {
    // The path is the same half-turn orbit the scene had when the world itself
    // rotated; keeping the radius steady is what makes it read as one move.
    for (const chapter of CAMERA_CHAPTERS) {
      const radius = Math.hypot(chapter.position[0], chapter.position[2]);
      expect(radius).toBeGreaterThan(28);
      expect(radius).toBeLessThan(36);
    }
  });

  it('never jumps between neighbouring shots', () => {
    for (let i = 1; i < CAMERA_CHAPTERS.length; i++) {
      const a = CAMERA_CHAPTERS[i - 1].position;
      const b = CAMERA_CHAPTERS[i].position;
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(40);
    }
  });

  it('swings out to one side rather than cutting across the island', () => {
    // Every interior shot sits off to the left, so the path arcs around the
    // terrain instead of through it.
    for (const chapter of CAMERA_CHAPTERS.slice(1, -1)) {
      expect(chapter.position[0]).toBeLessThan(-15);
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

describe('mapScrollToArc with a hold', () => {
  const hold = { start: 0.2, end: 0.4 };

  it('freezes the camera for the whole hold', () => {
    const atStart = mapScrollToArc(0.2, 0.8, hold);
    expect(mapScrollToArc(0.3, 0.8, hold)).toBeCloseTo(atStart, 6);
    expect(mapScrollToArc(0.4, 0.8, hold)).toBeCloseTo(atStart, 6);
  });

  it('resumes exactly where it left off, with no jump', () => {
    const atEnd = mapScrollToArc(0.4, 0.8, hold);
    const justAfter = mapScrollToArc(0.4001, 0.8, hold);
    expect(justAfter - atEnd).toBeLessThan(0.001);
    expect(justAfter).toBeGreaterThanOrEqual(atEnd);
  });

  it('still completes the arc by the time the arc ends', () => {
    expect(mapScrollToArc(0.8, 0.8, hold)).toBe(1);
  });

  it('is unchanged before the hold begins', () => {
    expect(mapScrollToArc(0.1, 0.8, hold)).toBeCloseTo(mapScrollToArc(0.1, 0.6), 6);
  });

  it('advances monotonically across the whole range', () => {
    let previous = -Infinity;
    for (let s = 0; s <= 1; s += 0.01) {
      const arc = mapScrollToArc(s, 0.8, hold);
      expect(arc).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = arc;
    }
  });

  it('behaves exactly as before when there is no hold', () => {
    for (const s of [0, 0.1, 0.3, 0.62, 1]) {
      expect(mapScrollToArc(s, 0.62, NO_HOLD)).toBeCloseTo(mapScrollToArc(s, 0.62), 9);
    }
  });

  it('degenerates safely when the hold swallows the entire arc', () => {
    const whole = { start: 0, end: 0.9 };
    expect(mapScrollToArc(0.5, 0.8, whole)).toBe(0);
    expect(mapScrollToArc(0.95, 0.8, whole)).toBe(1);
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
