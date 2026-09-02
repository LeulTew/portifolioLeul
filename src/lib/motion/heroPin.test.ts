import { describe, it, expect } from 'vitest';
import {
  HERO_HOLD_SCREENS,
  HERO_SCREENS,
  HOLD_CLOSE_END,
  holdCue,
  holdExit,
  holdProgress,
  pinOffset,
  scrolledIntoHold,
} from './heroPin';

const HOLD = 1000;

describe('the hold itself', () => {
  it('is longer than the screen the hero occupies', () => {
    // Without extra height there is no scroll to spend on the handover, and
    // the hero simply leaves with the page -- which is what this replaced.
    expect(HERO_HOLD_SCREENS).toBeGreaterThan(0);
    expect(HERO_SCREENS).toBe(1 + HERO_HOLD_SCREENS);
  });

  it('is not so long that being held reads as being stuck', () => {
    expect(HERO_HOLD_SCREENS).toBeLessThanOrEqual(2);
  });
});

describe('scrolledIntoHold', () => {
  it('is nothing before the section reaches the top of the window', () => {
    expect(scrolledIntoHold(500, HOLD)).toBe(0);
    expect(scrolledIntoHold(0, HOLD)).toBe(0);
  });

  it('tracks the scroll one to one through the hold', () => {
    expect(scrolledIntoHold(-250, HOLD)).toBe(250);
    expect(scrolledIntoHold(-1000, HOLD)).toBe(1000);
  });

  it('stops at the end of the hold rather than following forever', () => {
    // Past its turn the block has to be released, or it would ride the page
    // down over every section after it.
    expect(scrolledIntoHold(-5000, HOLD)).toBe(1000);
  });

  it('is inert without a hold to spend', () => {
    expect(scrolledIntoHold(-500, 0)).toBe(0);
    expect(scrolledIntoHold(Number.NaN, HOLD)).toBe(0);
  });
});

describe('pinOffset', () => {
  it('cancels the scroll exactly, so the block appears to stand still', () => {
    // This is the whole trick: push down by what was scrolled up.
    for (const scrolled of [0, 120, 640, 1000]) {
      expect(pinOffset(-scrolled, HOLD)).toBe(scrolled);
    }
  });

  it('holds at its last position once released', () => {
    expect(pinOffset(-2000, HOLD)).toBe(HOLD);
  });
});

describe('holdProgress', () => {
  it('runs zero to one across the hold', () => {
    expect(holdProgress(0, HOLD)).toBe(0);
    expect(holdProgress(-500, HOLD)).toBeCloseTo(0.5, 6);
    expect(holdProgress(-1000, HOLD)).toBe(1);
  });

  it('never exceeds one, however far past the hold', () => {
    expect(holdProgress(-9999, HOLD)).toBe(1);
  });
});

describe('holdExit', () => {
  it('is complete before the hold is, leaving room for the cue', () => {
    expect(holdExit(0)).toBe(0);
    expect(holdExit(HOLD_CLOSE_END)).toBe(1);
    expect(holdExit(1)).toBe(1);
    expect(HOLD_CLOSE_END).toBeLessThan(1);
  });

  it('scrubs continuously, because the layers stagger off it', () => {
    let previous = -1;
    for (let i = 0; i <= 20; i += 1) {
      const exit = holdExit(i / 20);
      expect(exit).toBeGreaterThanOrEqual(previous);
      previous = exit;
    }
  });
});

describe('holdCue', () => {
  it('draws nothing until the copy has left and the plate has shut', () => {
    expect(holdCue(0)).toBe(0);
    expect(holdCue(HOLD_CLOSE_END / 2)).toBe(0);
    expect(holdCue(HOLD_CLOSE_END)).toBe(0);
  });

  it('is fully drawn by the end of the hold, and stays there', () => {
    /*
     * The cue is the handover, so it has to be on screen pointing at what
     * comes next while the hero is still held -- not drawn and then carried
     * off the top of the window, which is what it did before.
     */
    expect(holdCue(1)).toBe(1);
    expect(holdCue(1.5)).toBe(1);
  });

  it('traces across what is left of the hold', () => {
    const midway = HOLD_CLOSE_END + (1 - HOLD_CLOSE_END) / 2;
    expect(holdCue(midway)).toBeCloseTo(0.5, 6);
  });

  it('never runs backwards', () => {
    let previous = -1;
    for (let i = 0; i <= 20; i += 1) {
      const drawn = holdCue(i / 20);
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });
});
