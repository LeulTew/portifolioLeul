import { describe, it, expect } from 'vitest';
import { transitProgress } from './bandProgress';

const ROOT = 800;
const BAND = 800;

describe('transitProgress', () => {
  it('is nothing before the band reaches the screen', () => {
    expect(transitProgress(ROOT, BAND, ROOT)).toBe(0);
    expect(transitProgress(ROOT + 400, BAND, ROOT)).toBe(0);
  });

  it('is complete once the band has left the top', () => {
    expect(transitProgress(-BAND, BAND, ROOT)).toBe(1);
    expect(transitProgress(-BAND - 500, BAND, ROOT)).toBe(1);
  });

  it('is halfway when the band is centred', () => {
    // Band centred: its top sits at (root - band) / 2.
    expect(transitProgress((ROOT - BAND) / 2, BAND, ROOT)).toBeCloseTo(0.5, 5);
  });

  it('advances as the band rises', () => {
    const a = transitProgress(600, BAND, ROOT);
    const b = transitProgress(200, BAND, ROOT);
    expect(b).toBeGreaterThan(a);
  });

  it('yields nothing rather than Infinity on a bad measurement', () => {
    for (const args of [
      [0, 0, ROOT],
      [0, BAND, 0],
      [Number.NaN, BAND, ROOT],
      [0, Number.NaN, ROOT],
      [0, BAND, Number.NaN],
    ] as const) {
      expect(transitProgress(...args)).toBe(0);
    }
  });
});
