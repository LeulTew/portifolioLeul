import { describe, it, expect } from 'vitest';
import {
  HERO_HOLD_SCREENS,
  HERO_SCREENS,
  HOLD_CLOSE_END,
  CUE_START_GAP,
  CUE_TIP_GAP,
  INNER_END,
  cueRail,
  innerExit,
  plateShut,
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

describe('the two beats of the exit', () => {
  it('empties the hero of its copy before the plate is touched', () => {
    /*
     * Reported. They used to overlap -- the plate began shutting while the
     * portrait was still on its way out -- which reads as the floor being
     * pulled from under something that has not left yet. The reader is being
     * held still precisely so there is time to do one and then the other.
     */
    expect(innerExit(INNER_END)).toBe(1);
    expect(plateShut(INNER_END)).toBe(0);
  });

  it('finishes the copy at exactly the moment the plate starts', () => {
    // No gap either: a pause between the two reads as a stall, not a beat.
    const justBefore = INNER_END - 1e-6;
    expect(innerExit(justBefore)).toBeLessThan(1);
    expect(plateShut(justBefore)).toBe(0);
  });

  it('shuts the plate across the rest of the close, and no further', () => {
    expect(plateShut(HOLD_CLOSE_END)).toBe(1);
    expect(plateShut(1)).toBe(1);
    expect(plateShut((INNER_END + HOLD_CLOSE_END) / 2)).toBeCloseTo(0.5, 6);
  });

  it('neither beat runs backwards', () => {
    let inner = -1;
    let shut = -1;
    for (let i = 0; i <= 40; i += 1) {
      const p = i / 40;
      expect(innerExit(p)).toBeGreaterThanOrEqual(inner);
      expect(plateShut(p)).toBeGreaterThanOrEqual(shut);
      inner = innerExit(p);
      shut = plateShut(p);
    }
  });

  it('clamps rather than inverting on out-of-range progress', () => {
    expect(innerExit(-1)).toBe(0);
    expect(innerExit(2)).toBe(1);
    expect(plateShut(-1)).toBe(0);
    expect(plateShut(Number.NaN)).toBe(0);
  });
});

describe('cueRail', () => {
  const H = 1000;
  const HOLD = H * HERO_HOLD_SCREENS;
  const PLATE_BOTTOM = 700;
  const HELD_TOP = H * HERO_SCREENS + 250;
  const HEADING = 160;
  const rail = cueRail(PLATE_BOTTOM, HELD_TOP, HEADING, HOLD, H);

  it('starts just under the plate, as the reader sees it, not as the page holds it', () => {
    /*
     * Reported: the line began drawing from off the top of the window. The
     * plate is pinned, so its screen offset is the same for the whole hold --
     * but drawing only starts once the copy has gone, by which time the reader
     * has scrolled that far. Anchoring at the screen offset alone put the
     * start of the line a whole departure's worth of scroll too high.
     */
    const drawStarts = HOLD * INNER_END;
    expect(rail.top).toBe(drawStarts + PLATE_BOTTOM + CUE_START_GAP);

    // On screen at that moment, it is exactly under the plate's bottom edge.
    expect(rail.top - drawStarts).toBe(PLATE_BOTTOM + CUE_START_GAP);
  });

  it('runs down to About, so it is as long as the gap it spans', () => {
    /*
     * About a screen and a bit: it reaches from under the plate to the heading
     * below and no further. Both ends are fixed by what they point at, so the
     * only way to shorten it is to shorten the hold it starts from -- which is
     * why the hold came down from 1.35 to 0.8 at the same time.
     *
     * The length is a consequence, not a setting -- which is the point. It is
     * exactly the distance between the plate's bottom edge and the words the
     * head comes to rest above.
     */
    expect(rail.height).toBeGreaterThan(H * 0.7);
    expect(rail.height).toBeLessThan(H * 1.2);
    expect(rail.top + rail.height).toBe(HELD_TOP + HEADING - CUE_TIP_GAP);
  });

  it('rests its head just above the heading as the held stretch takes over', () => {
    const headOnScreen = rail.top + rail.height - HELD_TOP;

    expect(headOnScreen).toBe(HEADING - CUE_TIP_GAP);
    expect(headOnScreen).toBeGreaterThan(0);
  });

  it('falls back to a sane aim before the heading has been measured', () => {
    const guessed = cueRail(PLATE_BOTTOM, HELD_TOP, 0, HOLD, H);
    expect(guessed.height).toBeGreaterThan(H * 0.5);
    expect(guessed.top).toBe(rail.top);
  });

  it('collapses rather than inverting when there is no gap to span', () => {
    expect(cueRail(3000, 1000, HEADING, HOLD, H)).toEqual({ top: 0, height: 0 });
    expect(cueRail(Number.NaN, HELD_TOP, HEADING, HOLD, H)).toEqual({ top: 0, height: 0 });
    expect(cueRail(PLATE_BOTTOM, HELD_TOP, HEADING, HOLD, 0)).toEqual({ top: 0, height: 0 });
    expect(cueRail(PLATE_BOTTOM, HELD_TOP, HEADING, Number.NaN, H)).toEqual({ top: 0, height: 0 });
  });
});

describe('cueDraw', () => {
  const H = 1000;
  const hold = H * HERO_HOLD_SCREENS;
  const ABOUT_TOP = H * HERO_SCREENS;
  const rail = cueRail(700, ABOUT_TOP + 250, 160, hold, H);
  const at = (scrolled: number) => cueDraw(-scrolled, hold, rail, H);

  /** Where the drawn head sits in the window, for a given scroll. */
  const headOnScreen = (scrolled: number) =>
    rail.top + at(scrolled) * rail.height - scrolled;

  it('draws nothing while the copy is still leaving', () => {
    // A line inviting the reader onward competes with what it leads away from.
    expect(at(0)).toBe(0);
    expect(at(hold * INNER_END * 0.5)).toBe(0);
    expect(at(hold * INNER_END)).toBe(0);
  });

  it('puts the head on the bottom edge exactly as the plate finishes', () => {
    /*
     * The requirement, stated precisely: the hero closes and the line has
     * already run off the bottom of the screen ahead of the reader.
     */
    expect(headOnScreen(hold * HOLD_CLOSE_END)).toBeCloseTo(H, 0);
  });

  it('draws alongside the plate shutting, not before or after it', () => {
    const mid = hold * ((INNER_END + HOLD_CLOSE_END) / 2);
    expect(at(mid)).toBeGreaterThan(0);
    expect(at(mid)).toBeLessThan(at(hold * HOLD_CLOSE_END));
  });

  it('keeps the head on the bottom edge as the reader travels', () => {
    // Which means they are always drawing the next stretch of it.
    for (const scrolled of [hold * 0.8, hold, hold * 1.15]) {
      if (at(scrolled) >= 1) continue;
      expect(headOnScreen(scrolled)).toBeCloseTo(H, 0);
    }
  });

  it('is complete before About has finished arriving, then holds', () => {
    expect(at(ABOUT_TOP)).toBe(1);
    expect(at(ABOUT_TOP + H * 2)).toBe(1);
  });

  it('never runs backwards', () => {
    let previous = -1;
    for (let i = 0; i <= 60; i += 1) {
      const drawn = at((i / 60) * ABOUT_TOP);
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });

  it('draws nothing rather than dividing by a span that does not exist', () => {
    expect(cueDraw(-500, 0, rail, H)).toBe(0);
    expect(cueDraw(-500, hold, { top: 0, height: 0 }, H)).toBe(0);
    expect(cueDraw(Number.NaN, hold, rail, H)).toBe(0);
    expect(cueDraw(-500, hold, rail, 0)).toBe(0);
  });
});
