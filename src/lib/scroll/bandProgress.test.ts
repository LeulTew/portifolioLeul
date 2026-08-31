import { describe, it, expect } from 'vitest';
import { transitProgress, centreFocus } from './bandProgress';

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
    ] as ReadonlyArray<readonly [number, number, number]>) {
      expect(transitProgress(...args)).toBe(0);
    }
  });
});

describe('centreFocus', () => {
  it('is full only at the middle of the screen', () => {
    expect(centreFocus(0.5)).toBe(1);
  });

  it('falls away either side, symmetrically', () => {
    expect(centreFocus(0.4)).toBeCloseTo(centreFocus(0.6), 10);
    expect(centreFocus(0.4)).toBeLessThan(1);
    expect(centreFocus(0.4)).toBeGreaterThan(0);
  });

  it('is nothing outside its window', () => {
    // The whole reason it is not presence: presence would still be full here.
    expect(centreFocus(0.5 - 0.3)).toBe(0);
    expect(centreFocus(0.5 + 0.3)).toBe(0);
    expect(centreFocus(0)).toBe(0);
    expect(centreFocus(1)).toBe(0);
  });

  it('peaks rather than plateaus', () => {
    const samples = [0.42, 0.46, 0.5, 0.54, 0.58].map((p) => centreFocus(p));
    expect(samples[2]).toBeGreaterThan(samples[1]);
    expect(samples[2]).toBeGreaterThan(samples[3]);
    expect(samples[1]).toBeGreaterThan(samples[0]);
  });

  it('sharpens as the window narrows', () => {
    expect(centreFocus(0.42, 0.12)).toBeLessThan(centreFocus(0.42, 0.4));
  });

  it('yields nothing rather than NaN on a bad measurement', () => {
    expect(centreFocus(Number.NaN)).toBe(0);
    expect(centreFocus(0.5, 0)).toBe(0);
    expect(centreFocus(0.5, Number.NaN)).toBe(0);
  });
});
