import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isFrameDrawn, isWorldOccluded, resetFrameGate, setFrameBudget } from './frameGate';
import { setWorldOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';

describe('frameGate', () => {
  beforeEach(() => {
    resetFrameGate();
    resetCameraHold();
    resetScrollProgress();
  });

  afterEach(() => {
    resetFrameGate();
    resetCameraHold();
    resetScrollProgress();
  });

  describe('with no budget and nothing covering the world', () => {
    it('draws every frame', () => {
      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0.016)).toBe(true);
      expect(isFrameDrawn(0.032)).toBe(true);
    });
  });

  describe('one decision per frame', () => {
    it('hands every caller in a frame the same answer', () => {
      // The whole point: the writers that feed a frame and the governor that
      // draws it must never disagree, or a frame is drawn from inputs that
      // were skipped.
      setFrameBudget(1 / 30);

      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0)).toBe(true);

      // A frame arriving too soon is refused, and stays refused all frame.
      expect(isFrameDrawn(0.016)).toBe(false);
      expect(isFrameDrawn(0.016)).toBe(false);
    });

    it('does not let a repeated query consume the interval', () => {
      setFrameBudget(1 / 30);
      isFrameDrawn(0);

      // Asking five times within the same frame must not advance the budget.
      for (let i = 0; i < 5; i += 1) isFrameDrawn(0.02);

      expect(isFrameDrawn(0.034)).toBe(true);
    });
  });

  describe('redraw ceiling', () => {
    it('holds a 30fps budget to roughly every other frame at 60', () => {
      setFrameBudget(1 / 30);

      let drawn = 0;
      for (let frame = 0; frame < 60; frame += 1) {
        if (isFrameDrawn(frame / 60)) drawn += 1;
      }

      // A whole second of 60fps frames, drawn at 30.
      expect(drawn).toBe(30);
    });

    it('draws every frame once the budget is cleared', () => {
      setFrameBudget(1 / 30);
      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0.016)).toBe(false);

      setFrameBudget(0);
      expect(isFrameDrawn(0.032)).toBe(true);
      expect(isFrameDrawn(0.048)).toBe(true);
    });

    it('treats a clock that restarted as a new sequence, not an early frame', () => {
      // Otherwise the backwards jump reads as "no time has passed since the
      // last draw" and the gate refuses every frame from then on.
      setFrameBudget(1 / 30);
      expect(isFrameDrawn(10)).toBe(true);

      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0.034)).toBe(true);
    });
  });

  describe('behind an opaque section', () => {
    it('reports the world occluded only inside the hold', () => {
      setWorldOcclusion({ start: 0.2, end: 0.5 });

      setScrollProgress(0.1);
      expect(isWorldOccluded()).toBe(false);

      setScrollProgress(0.35);
      expect(isWorldOccluded()).toBe(true);

      setScrollProgress(0.6);
      expect(isWorldOccluded()).toBe(false);
    });

    it('skips the frame outright, whatever the budget allows', () => {
      setFrameBudget(0);
      setWorldOcclusion({ start: 0.2, end: 0.5 });
      setScrollProgress(0.35);

      expect(isFrameDrawn(1)).toBe(false);
      expect(isFrameDrawn(2)).toBe(false);
    });

    it('resumes drawing immediately on the far side of the hold', () => {
      setWorldOcclusion({ start: 0.2, end: 0.5 });

      setScrollProgress(0.35);
      expect(isFrameDrawn(1)).toBe(false);

      setScrollProgress(0.55);
      expect(isFrameDrawn(2)).toBe(true);
    });

    it('does not spend the budget on a frame it refused to draw', () => {
      // A skipped frame must not count as a draw, or leaving the hold would
      // wait out an interval that was never spent on anything.
      setFrameBudget(1 / 30);
      setWorldOcclusion({ start: 0.2, end: 0.5 });

      setScrollProgress(0.35);
      expect(isFrameDrawn(5)).toBe(false);

      setScrollProgress(0.6);
      expect(isFrameDrawn(5.001)).toBe(true);
    });
  });

  describe('degenerate input', () => {
    it('draws rather than stalling when handed a time it cannot use', () => {
      expect(isFrameDrawn(Number.NaN)).toBe(true);
      expect(isFrameDrawn(Number.POSITIVE_INFINITY)).toBe(true);
    });

    it('ignores a budget that is not a positive interval', () => {
      setFrameBudget(Number.NaN);
      expect(isFrameDrawn(0)).toBe(true);
      expect(isFrameDrawn(0.001)).toBe(true);

      setFrameBudget(-1);
      expect(isFrameDrawn(0.002)).toBe(true);
    });
  });
});
