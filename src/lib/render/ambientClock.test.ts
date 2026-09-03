import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ambientTime, resetAmbientClock } from './ambientClock';
import { setCameraFreezes, resetCameraHold } from '@/lib/camera/cameraHold';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';

describe('ambientClock', () => {
  beforeEach(() => {
    resetAmbientClock();
    resetCameraHold();
    resetScrollProgress();
  });

  afterEach(() => {
    resetAmbientClock();
    resetCameraHold();
    resetScrollProgress();
  });

  describe('with nothing held', () => {
    it('is simply the elapsed clock', () => {
      expect(ambientTime(0)).toBe(0);
      expect(ambientTime(1.5)).toBe(1.5);
      expect(ambientTime(4)).toBe(4);
    });
  });

  describe('across a held section', () => {
    it('stops advancing, so the sky stops turning', () => {
      /*
       * The whole point. The star field rotates off this value, and a sky that
       * keeps turning through a hold reads as the background being rotated --
       * which is the one thing the hold exists to prevent.
       */
      setCameraFreezes([{ start: 0.2, end: 0.6 }]);

      setScrollProgress(0.1);
      expect(ambientTime(1)).toBe(1);

      setScrollProgress(0.3);
      expect(ambientTime(2)).toBe(2);
      expect(ambientTime(5)).toBe(2);
      expect(ambientTime(9)).toBe(2);
    });

    it('resumes from where it stopped, without a jump', () => {
      // A hold that banked its frozen span and then handed it back would snap
      // the sky forward the moment the reader scrolled on.
      setCameraFreezes([{ start: 0.2, end: 0.6 }]);

      setScrollProgress(0.3);
      expect(ambientTime(2)).toBe(2);
      expect(ambientTime(10)).toBe(2);

      setScrollProgress(0.7);
      // Eight seconds were spent frozen, so they are discounted entirely.
      expect(ambientTime(10.5)).toBeCloseTo(2.5, 6);
      expect(ambientTime(11)).toBeCloseTo(3, 6);
    });

    it('never runs backwards across a freeze', () => {
      setCameraFreezes([{ start: 0.2, end: 0.6 }]);

      let previous = -1;
      for (let i = 0; i <= 30; i += 1) {
        setScrollProgress(i / 30);
        const time = ambientTime(i * 0.5);
        expect(time).toBeGreaterThanOrEqual(previous);
        previous = time;
      }
    });

    it('freezes again on a second hold, banking both spans', () => {
      setCameraFreezes([{ start: 0.1, end: 0.2 }, { start: 0.5, end: 0.7 }]);

      setScrollProgress(0.15);
      expect(ambientTime(1)).toBe(1);
      expect(ambientTime(3)).toBe(1);

      setScrollProgress(0.3);
      expect(ambientTime(4)).toBeCloseTo(2, 6);

      setScrollProgress(0.6);
      expect(ambientTime(5)).toBeCloseTo(3, 6);
      expect(ambientTime(8)).toBeCloseTo(3, 6);

      setScrollProgress(0.8);
      expect(ambientTime(9)).toBeCloseTo(4, 6);
    });
  });

  describe('one decision per frame', () => {
    it('hands every caller in a frame the same time', () => {
      // The star field and the drift must not disagree about what time it is,
      // or they part company mid-frame.
      setCameraFreezes([{ start: 0.2, end: 0.6 }]);
      setScrollProgress(0.3);

      expect(ambientTime(2)).toBe(2);
      expect(ambientTime(2)).toBe(2);

      setScrollProgress(0.7);
      // Still the same frame, so still the frozen answer.
      expect(ambientTime(2)).toBe(2);
    });
  });

  describe('degenerate input', () => {
    it('holds its last answer rather than emitting a time it cannot use', () => {
      expect(ambientTime(3)).toBe(3);
      expect(ambientTime(Number.NaN)).toBe(3);
      expect(ambientTime(Number.POSITIVE_INFINITY)).toBe(3);
    });

    it('treats a restarted clock as a new sequence', () => {
      setCameraFreezes([{ start: 0.2, end: 0.6 }]);
      setScrollProgress(0.3);
      expect(ambientTime(10)).toBe(10);

      setScrollProgress(0.8);
      expect(ambientTime(0)).toBe(0);
      expect(ambientTime(1)).toBe(1);
    });
  });
});
