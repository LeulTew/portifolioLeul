import { describe, it, expect } from 'vitest';
import {
  clamp01,
  pinOffset,
  pinProgress,
  recordAt,
  recordWindow,
  stepDistance,
  trackOffset,
} from './railTransit';

describe('clamp01', () => {
  it('holds the ends and refuses nonsense', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('pinOffset', () => {
  it('leaves the frame in the flow until the rail reaches the top', () => {
    expect(pinOffset(500, 3000, 800)).toBe(0);
    expect(pinOffset(0, 3000, 800)).toBe(0);
  });

  it('holds the frame exactly still once the rail has climbed past it', () => {
    // Offsetting by precisely what the rail has moved is what "held" means:
    // any other number and the frame drifts on screen while it is pinned.
    expect(pinOffset(-250, 3000, 800)).toBe(250);
    expect(pinOffset(-1999, 3000, 800)).toBe(1999);
  });

  it('lets go at the bottom of the rail rather than overrunning it', () => {
    // Without the ceiling the frame would be carried on out of its own
    // section and sit on top of whatever came next.
    expect(pinOffset(-5000, 3000, 800)).toBe(2200);
  });

  it('never pins a rail with no room to pin in', () => {
    expect(pinOffset(-500, 800, 800)).toBe(0);
    expect(pinOffset(Number.NaN, 3000, 800)).toBe(0);
  });
});

describe('pinProgress', () => {
  it('reports the share of the hold that has been spent', () => {
    expect(pinProgress(0, 3000, 800)).toBe(0);
    expect(pinProgress(1100, 3000, 800)).toBeCloseTo(0.5, 5);
    expect(pinProgress(2200, 3000, 800)).toBe(1);
  });

  it('is zero when there is nothing to spend', () => {
    expect(pinProgress(100, 800, 800)).toBe(0);
  });
});

describe('recordWindow', () => {
  it('spends nothing on the opening and nothing on the release', () => {
    expect(recordWindow(0)).toBe(0);
    expect(recordWindow(0.14)).toBe(0);
    expect(recordWindow(0.92)).toBe(1);
    expect(recordWindow(1)).toBe(1);
  });

  it('runs the whole set across the stretch in between', () => {
    expect(recordWindow(0.53)).toBeCloseTo(0.5, 2);
  });
});

describe('recordAt', () => {
  it('gives each record an equal share of the window', () => {
    expect(recordAt(0, 4)).toBe(0);
    expect(recordAt(0.24, 4)).toBe(0);
    expect(recordAt(0.26, 4)).toBe(1);
    expect(recordAt(0.51, 4)).toBe(2);
    expect(recordAt(0.76, 4)).toBe(3);
  });

  it('stops at the last record rather than running one past the set', () => {
    expect(recordAt(1, 4)).toBe(3);
    expect(recordAt(4, 4)).toBe(3);
  });

  it('survives an empty set', () => {
    expect(recordAt(0.5, 0)).toBe(0);
  });
});

describe('trackOffset', () => {
  it('moves the track by exactly one record per index', () => {
    // The track is `count` records wide, so one record is 100 / count of it.
    expect(trackOffset(0, 4)).toBe(0);
    expect(trackOffset(1, 4)).toBe(-25);
    expect(trackOffset(3, 4)).toBe(-75);
  });

  it('never travels backwards past the first record', () => {
    expect(trackOffset(-2, 4)).toBe(0);
  });
});

describe('stepDistance', () => {
  it('is the scroll one record costs, so a control click lands on one', () => {
    // 2200px of hold, 78% of it spent on records, four records.
    expect(stepDistance(3000, 800, 4)).toBeCloseTo((0.78 * 2200) / 4, 5);
  });

  it('is nothing when there is nowhere to step', () => {
    expect(stepDistance(3000, 800, 1)).toBe(0);
    expect(stepDistance(800, 800, 4)).toBe(0);
  });
});
