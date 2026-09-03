import { describe, it, expect } from 'vitest';
import {
  HERO_HOLD_SCREENS,
  HERO_SCREENS,
  HOLD_CLOSE_END,
  CUE_DRAW_SCREENS,
  CUE_LEAD,
  cueDraw,
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

describe('cueDraw', () => {
  /*
   * A thousand-pixel window, so the hold is 1350px and the numbers below are
   * readable: the cue starts at 1188px scrolled and is finished at 1900px --
   * 550px PAST the release, which is the point of it.
   */
  const H = 1000;
  const hold = H * HERO_HOLD_SCREENS;
  const at = (scrolled: number) => cueDraw(-scrolled, hold, H);

  it('draws nothing for most of the hold', () => {
    // The copy is leaving and the plate is shutting; a line inviting the
    // reader onward while that happens competes with it.
    expect(at(0)).toBe(0);
    expect(at(hold * 0.5)).toBe(0);
    expect(at(hold * (1 - CUE_LEAD))).toBe(0);
  });

  it('has started, but only just, by the time the page comes unstuck', () => {
    /*
     * The requirement, exactly: it begins animating as the page is about to
     * start scrolling again -- not completed while it was still below the
     * window, which is what tying it to the hold alone did.
     */
    const atRelease = at(hold);
    expect(atRelease).toBeGreaterThan(0);
    expect(atRelease).toBeLessThan(0.35);
  });

  it('finishes over the screen after the hold, not inside it', () => {
    // This is what makes it a line reaching into the next section: most of
    // the stroke is spent on scroll that is moving About up to meet it.
    expect(at(hold + H * CUE_DRAW_SCREENS)).toBe(1);
    expect(at(hold + H * CUE_DRAW_SCREENS * 0.5)).toBeLessThan(1);
  });

  it('stays drawn once it is done', () => {
    expect(at(hold + H * 3)).toBe(1);
  });

  it('never runs backwards', () => {
    let previous = -1;
    for (let i = 0; i <= 40; i += 1) {
      const drawn = at((i / 40) * (hold + H));
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });

  it('draws nothing rather than dividing by a hold that does not exist', () => {
    expect(cueDraw(-500, 0, H)).toBe(0);
    expect(cueDraw(-500, hold, 0)).toBe(0);
    expect(cueDraw(Number.NaN, hold, H)).toBe(0);
  });
});
