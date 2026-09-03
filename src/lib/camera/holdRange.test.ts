import { describe, it, expect } from 'vitest';
import { NO_HOLD, computeHoldRange, holdSpan, isWithinHold, type ArcHold, NO_HOLDS, frozenBefore, isWithinAnyHold, isCameraFrozen, totalHeldSpan } from './holdRange';

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

describe('more than one hold', () => {
  const hero = { start: 0.05, end: 0.2 };
  const about = { start: 0.4, end: 0.6 };
  const holds = [hero, about];

  describe('frozenBefore', () => {
    it('counts nothing before the first hold', () => {
      expect(frozenBefore(0.02, holds)).toBe(0);
      expect(frozenBefore(0.05, holds)).toBe(0);
    });

    it('counts only what has been spent inside the hold being held', () => {
      /*
       * The whole reason the camera stays still. If the part of a hold already
       * scrolled through were not subtracted, the arc would creep across it --
       * which is what sent the viewpoint flying over the island when the hero
       * was first given a hold.
       */
      expect(frozenBefore(0.1, holds)).toBeCloseTo(0.05, 9);
      expect(frozenBefore(0.2, holds)).toBeCloseTo(0.15, 9);
    });

    it('counts a hold in full once it has been passed', () => {
      expect(frozenBefore(0.3, holds)).toBeCloseTo(0.15, 9);
    });

    it('accumulates across every hold behind the reader', () => {
      expect(frozenBefore(0.5, holds)).toBeCloseTo(0.15 + 0.1, 9);
      expect(frozenBefore(0.9, holds)).toBeCloseTo(0.15 + 0.2, 9);
    });

    it('is unaffected by the order they are given in', () => {
      expect(frozenBefore(0.5, [about, hero])).toBeCloseTo(frozenBefore(0.5, holds), 9);
    });

    it('ignores holds that span nothing', () => {
      expect(frozenBefore(0.9, [{ start: 0.3, end: 0.3 }, NO_HOLD])).toBe(0);
    });
  });

  describe('isCameraFrozen', () => {
    it('is true from the very start of a hold, not one step after it', () => {
      /*
       * The hero's hold begins at zero. Excluding the start left the pointer
       * parallax live at the top of the page and then snapped the viewpoint
       * away on the first wheel tick -- the island drifting under a hero that
       * is supposed to be pinned, which is the whole thing a hold prevents.
       */
      expect(isCameraFrozen(0, [{ start: 0, end: 0.4 }])).toBe(true);
      expect(isWithinAnyHold(0, [{ start: 0, end: 0.4 }])).toBe(false);
    });

    it('holds through the span and lets go at the far edge', () => {
      const holds: ArcHold[] = [{ start: 0, end: 0.4 }, { start: 0.7, end: 0.9 }];
      expect(isCameraFrozen(0.2, holds)).toBe(true);
      expect(isCameraFrozen(0.4, holds)).toBe(false);
      expect(isCameraFrozen(0.55, holds)).toBe(false);
      expect(isCameraFrozen(0.7, holds)).toBe(true);
      expect(isCameraFrozen(0.95, holds)).toBe(false);
    });

    it('is never frozen by an empty list or a zero-width hold', () => {
      expect(isCameraFrozen(0.5, NO_HOLDS)).toBe(false);
      expect(isCameraFrozen(0.5, [{ start: 0.5, end: 0.5 }])).toBe(false);
      expect(isCameraFrozen(Number.NaN, [{ start: 0, end: 1 }])).toBe(false);
    });
  });

  describe('isWithinAnyHold', () => {
    it('is true inside either', () => {
      expect(isWithinAnyHold(0.1, holds)).toBe(true);
      expect(isWithinAnyHold(0.5, holds)).toBe(true);
    });

    it('is false in the travel between and beyond them', () => {
      expect(isWithinAnyHold(0.3, holds)).toBe(false);
      expect(isWithinAnyHold(0.9, holds)).toBe(false);
    });

    it('is false with no holds at all', () => {
      expect(isWithinAnyHold(0.5, NO_HOLDS)).toBe(false);
    });
  });

  describe('totalHeldSpan', () => {
    it('adds up every hold', () => {
      expect(totalHeldSpan(holds)).toBeCloseTo(0.35, 9);
      expect(totalHeldSpan(NO_HOLDS)).toBe(0);
    });
  });
});
