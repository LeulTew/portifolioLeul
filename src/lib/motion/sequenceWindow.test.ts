import { describe, it, expect } from 'vitest';
import { windowPresence, layerOpacity } from './sequenceWindow';

describe('windowPresence', () => {
  it('is nothing outside its window', () => {
    expect(windowPresence(0.1, 0.2, 0.5, 0.08)).toBe(0);
    expect(windowPresence(0.6, 0.2, 0.5, 0.08)).toBe(0);
    expect(windowPresence(0.2, 0.2, 0.5, 0.08)).toBe(0);
    expect(windowPresence(0.5, 0.2, 0.5, 0.08)).toBe(0);
  });

  it('is full through the middle of its window', () => {
    expect(windowPresence(0.35, 0.2, 0.5, 0.08)).toBe(1);
  });

  it('ramps at both ends', () => {
    const rising = windowPresence(0.24, 0.2, 0.5, 0.08);
    const falling = windowPresence(0.46, 0.2, 0.5, 0.08);
    expect(rising).toBeGreaterThan(0);
    expect(rising).toBeLessThan(1);
    expect(falling).toBeCloseTo(rising, 10);
  });

  it('hands over: one layer is gone before the next begins', () => {
    // The whole point of a sequence rather than a crossfade.
    const first = windowPresence(0.52, 0.15, 0.5, 0.08);
    const second = windowPresence(0.52, 0.55, 0.9, 0.08);
    expect(first).toBe(0);
    expect(second).toBe(0);
  });

  it('still peaks in the middle when the window is narrower than its ramps', () => {
    const middle = windowPresence(0.5, 0.45, 0.55, 0.2);
    expect(middle).toBeGreaterThan(windowPresence(0.47, 0.45, 0.55, 0.2));
    expect(middle).toBeLessThanOrEqual(1);
  });

  it('falls back to a hard window rather than dividing by no feather', () => {
    expect(windowPresence(0.3, 0.2, 0.5, 0)).toBe(1);
    expect(windowPresence(0.7, 0.2, 0.5, 0)).toBe(0);
  });

  it('yields nothing on a bad window or measurement', () => {
    expect(windowPresence(0.3, 0.5, 0.2, 0.08)).toBe(0);
    expect(windowPresence(0.3, 0.2, 0.2, 0.08)).toBe(0);
    expect(windowPresence(Number.NaN, 0.2, 0.5, 0.08)).toBe(0);
  });
});

describe('layerOpacity', () => {
  it('holds at nothing while the layer is still on its way in', () => {
    // A fifth present must not mean a fifth visible: that is a large soft
    // ghost sitting on screen for the whole approach.
    expect(layerOpacity(0.2)).toBeLessThan(0.01);
    expect(layerOpacity(0.4)).toBeLessThan(0.07);
  });

  it('is fully opaque only when fully present', () => {
    expect(layerOpacity(1)).toBe(1);
  });

  it('rises faster than presence near the end, so it arrives sharp', () => {
    // By the time it is visible at all it is nearly in focus.
    expect(layerOpacity(0.9)).toBeGreaterThan(0.7);
  });

  it('never outruns presence', () => {
    for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(layerOpacity(p)).toBeLessThanOrEqual(p);
    }
  });

  it('clamps rather than trusting its input', () => {
    expect(layerOpacity(4)).toBe(1);
    expect(layerOpacity(-1)).toBe(0);
    expect(layerOpacity(Number.NaN)).toBe(0);
  });
});
