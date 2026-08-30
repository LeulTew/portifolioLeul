import { describe, it, expect } from 'vitest';
import { bandPresence } from './bandPresence';

describe('bandPresence', () => {
  it('is nothing before the band arrives', () => {
    expect(bandPresence(0, 400, 800)).toBe(0);
  });

  it('reaches full for a band shorter than the screen', () => {
    // The whole point: a 400px row in an 800px viewport can only ever cover
    // half of it, and must still count as fully present when it is all there.
    expect(bandPresence(0.5, 400, 800)).toBe(1);
  });

  it('ramps in proportion on the way there', () => {
    expect(bandPresence(0.25, 400, 800)).toBeCloseTo(0.5, 5);
    expect(bandPresence(0.125, 400, 800)).toBeCloseTo(0.25, 5);
  });

  it('treats a band taller than the screen as full once it fills it', () => {
    expect(bandPresence(1, 2400, 800)).toBe(1);
    expect(bandPresence(0.5, 2400, 800)).toBeCloseTo(0.5, 5);
  });

  it('never exceeds full, however the band is measured', () => {
    expect(bandPresence(1, 100, 800)).toBe(1);
  });

  it('is nothing rather than infinite when a measurement is missing', () => {
    // A band measured before layout has zero height; dividing by it would
    // give Infinity and pin the content on at every scroll position.
    for (const args of [
      [0.4, 0, 800],
      [0.4, 400, 0],
      [Number.NaN, 400, 800],
      [0.4, Number.NaN, 800],
      [0.4, 400, Number.NaN],
      [-1, 400, 800],
    ] as const) {
      expect(bandPresence(...args)).toBe(0);
    }
  });
});
