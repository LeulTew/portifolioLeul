import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STRIP_COUNT,
  THROW_COMMIT_VELOCITY,
  calculateStripTransform,
  stripDelayFraction,
  shouldCommitTurn,
} from './stripTransform';

const N = DEFAULT_STRIP_COUNT;

describe('calculateStripTransform', () => {
  it('leaves the sheet flat at the start of the sweep', () => {
    for (let i = 0; i < N; i++) {
      const t = calculateStripTransform(i, N, 0);
      expect(t.angle).toBeCloseTo(0, 6);
      expect(t.translateX).toBeCloseTo(0, 6);
      expect(t.shadowOpacity).toBeCloseTo(0, 6);
    }
  });

  it('leaves the sheet flat again once the sweep completes', () => {
    for (let i = 0; i < N; i++) {
      const t = calculateStripTransform(i, N, 1);
      expect(t.angle).toBeCloseTo(0, 6);
      expect(t.shadowOpacity).toBeCloseTo(0, 6);
    }
  });

  it('bends most in the middle of the sweep', () => {
    const mid = calculateStripTransform(N - 1, N, 0.5).angle;
    const early = calculateStripTransform(N - 1, N, 0.15).angle;
    const late = calculateStripTransform(N - 1, N, 0.85).angle;

    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeGreaterThan(late);
  });

  it('bends progressively more along the sheet', () => {
    let previous = -Infinity;
    for (let i = 0; i < N; i++) {
      const angle = calculateStripTransform(i, N, 0.5).angle;
      expect(angle).toBeGreaterThanOrEqual(previous);
      previous = angle;
    }
  });

  it('moves the far edge less than the near edge, so the sheet lags', () => {
    const near = calculateStripTransform(0, N, 0.5).translateX;
    const far = calculateStripTransform(N - 1, N, 0.5).translateX;
    expect(far).toBeLessThan(near);
  });

  it('advances travel monotonically with progress', () => {
    let previous = -Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const travel = calculateStripTransform(4, N, p).translateX;
      expect(travel).toBeGreaterThanOrEqual(previous);
      previous = travel;
    }
  });

  it('casts the deepest contact shadow at the leading edge', () => {
    const leading = calculateStripTransform(0, N, 0.5).shadowOpacity;
    const trailing = calculateStripTransform(N - 1, N, 0.5).shadowOpacity;
    expect(leading).toBeGreaterThan(trailing);
  });

  it('keeps the shadow within a usable opacity range', () => {
    for (let i = 0; i < N; i++) {
      for (let p = 0; p <= 1; p += 0.1) {
        const { shadowOpacity } = calculateStripTransform(i, N, p);
        expect(shadowOpacity).toBeGreaterThanOrEqual(0);
        expect(shadowOpacity).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('clamps progress outside the sweep', () => {
    expect(calculateStripTransform(3, N, -2)).toEqual(calculateStripTransform(3, N, 0));
    expect(calculateStripTransform(3, N, 5)).toEqual(calculateStripTransform(3, N, 1));
  });

  it('degenerates safely for a non-positive or non-finite strip count', () => {
    expect(calculateStripTransform(0, 0, 0.5)).toEqual({
      angle: 0,
      translateX: 0,
      shadowOpacity: 0,
    });
    expect(calculateStripTransform(0, Number.NaN, 0.5).angle).toBe(0);
  });

  it('treats non-finite input as the start of the sheet', () => {
    expect(calculateStripTransform(Number.NaN, N, 0.5).angle).toBeCloseTo(0, 6);
  });
});

describe('stripDelayFraction', () => {
  it('starts the leading strip immediately', () => {
    expect(stripDelayFraction(0, N)).toBe(0);
  });

  it('delays the trailing strip by the full stagger', () => {
    expect(stripDelayFraction(N - 1, N, 0.35)).toBeCloseTo(0.35, 6);
  });

  it('staggers monotonically along the sheet', () => {
    let previous = -Infinity;
    for (let i = 0; i < N; i++) {
      const delay = stripDelayFraction(i, N);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });

  it('never delays past the transition itself', () => {
    for (let i = 0; i < N; i++) {
      expect(stripDelayFraction(i, N)).toBeLessThan(1);
    }
  });

  it('has nothing to stagger for a single strip', () => {
    expect(stripDelayFraction(0, 1)).toBe(0);
    expect(stripDelayFraction(3, Number.NaN)).toBe(0);
  });
});

describe('shouldCommitTurn', () => {
  it('commits a fast forward throw even from near the start', () => {
    expect(shouldCommitTurn(0.1, THROW_COMMIT_VELOCITY + 0.1)).toBe(true);
  });

  it('rejects a fast backward throw even from near the end', () => {
    expect(shouldCommitTurn(0.9, -(THROW_COMMIT_VELOCITY + 0.1))).toBe(false);
  });

  it('falls back to position for a slow release', () => {
    expect(shouldCommitTurn(0.7, 0.05)).toBe(true);
    expect(shouldCommitTurn(0.3, 0.05)).toBe(false);
  });

  it('treats the halfway point as not yet committed', () => {
    expect(shouldCommitTurn(0.5, 0)).toBe(false);
  });

  it('falls back to position for a non-finite velocity', () => {
    expect(shouldCommitTurn(0.8, Number.NaN)).toBe(true);
    expect(shouldCommitTurn(0.2, Number.NaN)).toBe(false);
  });
});
