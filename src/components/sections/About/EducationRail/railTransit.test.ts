import { describe, it, expect } from 'vitest';
import { releaseOffset, stageVisible, trackOffset } from './railTransit';

describe('entry and release geometry', () => {
  it('identifies the physical window without selecting or advancing a record', () => {
    expect(stageVisible(1, 3000, 800)).toBe(false);
    expect(stageVisible(0, 3000, 800)).toBe(true);
    expect(stageVisible(-2200, 3000, 800)).toBe(true);
    expect(releaseOffset(-2200, 3000, 800)).toBe(0);
    expect(releaseOffset(-3000, 3000, 800)).toBe(800);
    expect(stageVisible(-3000, 3000, 800)).toBe(false);
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
