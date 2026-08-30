import { describe, it, expect } from 'vitest';
import {
  NO_HOLD,
  computeHoldRange,
  holdSpan,
  isWithinHold,
  type ArcHold,
} from './holdRange';

describe('holdSpan', () => {
  it('measures the scroll a hold consumes', () => {
    expect(holdSpan({ start: 0.2, end: 0.5 })).toBeCloseTo(0.3, 6);
  });

  it('is zero for an empty or inverted range', () => {
    expect(holdSpan(NO_HOLD)).toBe(0);
    expect(holdSpan({ start: 0.6, end: 0.2 })).toBe(0);
  });

  it('is zero for a non-finite range', () => {
    expect(holdSpan({ start: Number.NaN, end: 0.5 })).toBe(0);
  });
});

describe('isWithinHold', () => {
  const hold: ArcHold = { start: 0.2, end: 0.5 };

  it('is true inside the hold', () => {
    expect(isWithinHold(0.35, hold)).toBe(true);
  });

  it('is false outside the hold', () => {
    expect(isWithinHold(0.1, hold)).toBe(false);
    expect(isWithinHold(0.8, hold)).toBe(false);
  });

  it('treats the boundaries as still moving, so nothing freezes on arrival', () => {
    expect(isWithinHold(0.2, hold)).toBe(false);
    expect(isWithinHold(0.5, hold)).toBe(false);
  });

  it('is never true without a hold', () => {
    expect(isWithinHold(0.5, NO_HOLD)).toBe(false);
  });
});

describe('computeHoldRange', () => {
  const CONTENT = 8000;
  const VIEWPORT = 1000;

  it('holds from the section reaching the top to its bottom reaching the bottom', () => {
    const hold = computeHoldRange(2000, 3000, CONTENT, VIEWPORT);
    const travel = CONTENT - VIEWPORT;

    expect(hold.start).toBeCloseTo(2000 / travel, 6);
    expect(hold.end).toBeCloseTo((2000 + 3000 - VIEWPORT) / travel, 6);
  });

  it('never holds for a section shorter than the viewport', () => {
    // Such a section never fills the screen, so the world is always visible.
    expect(computeHoldRange(2000, 800, CONTENT, VIEWPORT)).toBe(NO_HOLD);
    expect(computeHoldRange(2000, VIEWPORT, CONTENT, VIEWPORT)).toBe(NO_HOLD);
  });

  it('adapts to viewport height, so the same section holds differently', () => {
    const onTablet = computeHoldRange(2000, 3000, CONTENT, 700);
    const onDesktop = computeHoldRange(2000, 3000, CONTENT, 1400);

    // A taller viewport is filled for less of the scroll.
    expect(holdSpan(onTablet)).toBeGreaterThan(holdSpan(onDesktop));
  });

  it('stays inside the normalized range', () => {
    const hold = computeHoldRange(7500, 4000, CONTENT, VIEWPORT);
    expect(hold.start).toBeGreaterThanOrEqual(0);
    expect(hold.end).toBeLessThanOrEqual(1);
  });

  it('returns no hold for degenerate geometry', () => {
    expect(computeHoldRange(0, 3000, 500, 1000)).toBe(NO_HOLD);
    expect(computeHoldRange(0, 3000, CONTENT, 0)).toBe(NO_HOLD);
    expect(computeHoldRange(Number.NaN, 3000, CONTENT, VIEWPORT)).toBe(NO_HOLD);
  });
});
