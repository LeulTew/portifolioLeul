import { describe, expect, it } from 'vitest';
import { cueDraw, cuePresence, cueRail, cueRest, CUE_TIP_GAP } from './heroPin';

describe('the original hero-to-About journey', () => {
  it('starts below the hero and lands at the same measured heading gap', () => {
    const rail = cueRail(700, 1080, 128, 280, 800);
    expect(rail.top - 280 * 0.42).toBe(712);
    expect(rail.top - 1080 + rail.height).toBeCloseTo(128 - CUE_TIP_GAP);
  });

  it('matches the historical scroll positions without an additional drawing clock', () => {
    expect(cueDraw(-117.6, 280, 1080)).toBe(0);
    expect(cueDraw(-598.8, 280, 1080)).toBeCloseTo(0.5);
    expect(cueDraw(-1080, 280, 1080)).toBe(1);
  });

  it('stops at the requested spatial position rather than drawing into an unseen section', () => {
    for (let frame = 0; frame < 80; frame++) {
      expect(cueDraw(-358.2, 280, 1080)).toBeCloseTo(0.25);
    }
  });

  it('reverses the original hold and fade windows at identical scroll positions', () => {
    expect(cueRest(-1192, 1080, 800)).toBe(112);
    expect(cuePresence(-1192, 1080, 800)).toBe(1);
    expect(cuePresence(-1228, 1080, 800)).toBeCloseTo(0.5);
    expect(cuePresence(-1264, 1080, 800)).toBe(0);
    expect(cuePresence(-1192, 1080, 800)).toBe(1);
    expect(cueDraw(-598.8, 280, 1080)).toBeCloseTo(0.5);
  });
});
