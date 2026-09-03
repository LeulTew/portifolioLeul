import { describe, it, expect } from 'vitest';
import {
  HERO_HOLD_SCREENS,
  HERO_SCREENS,
  HOLD_CLOSE_END,
  CUE_START_GAP,
  CUE_TIP_GAP,
  INNER_END,
  cueRail,
  cueRest,
  cuePresence,
  CUE_REST_SCREENS,
  CUE_FADE_SCREENS,
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

  it('starts under the plate as the plate begins to shut', () => {
    /*
     * The plate is pinned, so its offset is a screen position for the whole
     * hold, and the page position that lines up with it is that scroll plus
     * that offset. Drawing begins when the copy has gone, which is where the
     * plate's own beat starts.
     */
    const drawStarts = HOLD * INNER_END;
    expect(rail.top).toBe(drawStarts + PLATE_BOTTOM + CUE_START_GAP);
    // On screen at that moment, it is exactly under the plate's bottom edge.
    expect(rail.top - drawStarts).toBe(PLATE_BOTTOM + CUE_START_GAP);
  });

  it('is shorter than the window it is drawn in', () => {
    /*
     * Reported as too long. Its ends are fixed by what they point at, so its
     * length is a consequence of the hold: the hero is `1 + hold` screens
     * tall, and the mark spans most of that. Bringing the hold down from 1.35
     * screens to a third is what shortened it.
     */
    expect(rail.height).toBeLessThan(H);
    expect(rail.height).toBeGreaterThan(H * 0.2);
  });

  it('rests its head just above the heading as the held stretch takes over', () => {
    const headOnScreen = rail.top + rail.height - HELD_TOP;

    expect(headOnScreen).toBe(HEADING - CUE_TIP_GAP);
    expect(headOnScreen).toBeGreaterThan(0);
  });

  it('falls back to a sane aim before the heading has been measured', () => {
    const guessed = cueRail(PLATE_BOTTOM, HELD_TOP, 0, HOLD, H);
    expect(guessed.height).toBeGreaterThan(0);
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
  const HELD_TOP = H * HERO_SCREENS + 250;
  const rail = cueRail(700, HELD_TOP, 160, hold, H);
  const at = (scrolled: number) => cueDraw(-scrolled, hold, HELD_TOP);

  /** Where the drawn head sits in the window, for a given scroll. */
  const headOnScreen = (scrolled: number) =>
    rail.top + at(scrolled) * rail.height - scrolled;

  it('draws nothing while the copy is still leaving', () => {
    // A line inviting the reader onward competes with what it leads them from.
    expect(at(0)).toBe(0);
    expect(at(hold * INNER_END * 0.5)).toBe(0);
    expect(at(hold * INNER_END)).toBe(0);
  });

  it('starts as the plate begins to shut', () => {
    expect(at(hold * INNER_END + 1)).toBeGreaterThan(0);
    expect(at(hold * HOLD_CLOSE_END)).toBeGreaterThan(0);
  });

  it('has the panel already climbing for most of the drawing', () => {
    /*
     * Reported: the mark was drawn down an empty hero. The section underneath
     * cannot start climbing until the hold is spent -- that is what the hold
     * is -- so the fix is a shorter hold, not a later mark. Most of the
     * drawing now happens with the panel on its way up.
     */
    const drawSpan = HELD_TOP - hold * INNER_END;
    const waitingForPanel = hold - hold * INNER_END;
    expect(waitingForPanel / drawSpan).toBeLessThan(0.25);
  });

  it('grows downward from under the plate as the panel rises', () => {
    const start = hold * INNER_END;
    const early = headOnScreen(start + (HELD_TOP - start) * 0.25);
    const later = headOnScreen(start + (HELD_TOP - start) * 0.6);

    expect(headOnScreen(hold * INNER_END)).toBeCloseTo(700 + CUE_START_GAP, 6);
    expect(later).toBeLessThan(early);
  });

  it('is complete, head at rest, as the held stretch takes over', () => {
    expect(at(HELD_TOP)).toBe(1);
    expect(headOnScreen(HELD_TOP)).toBe(160 - CUE_TIP_GAP);
  });

  it('stays drawn once it is done', () => {
    expect(at(HELD_TOP + H * 3)).toBe(1);
  });

  it('never runs backwards', () => {
    let previous = -1;
    for (let i = 0; i <= 60; i += 1) {
      const drawn = at((i / 60) * HELD_TOP);
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });

  it('draws nothing rather than dividing by a span that does not exist', () => {
    expect(cueDraw(-500, hold, hold * INNER_END)).toBe(0);
    expect(cueDraw(Number.NaN, hold, HELD_TOP)).toBe(0);
    expect(cueDraw(-500, hold, Number.NaN)).toBe(0);
  });
});

describe('the mark keeping its place, and then leaving', () => {
  const H = 1000;
  const HELD_TOP = 2000;
  const rest = (scrolled: number) => cueRest(-scrolled, HELD_TOP, H);
  const presence = (scrolled: number) => cuePresence(-scrolled, HELD_TOP, H);

  it('does not hold anything before the head is at rest', () => {
    expect(rest(0)).toBe(0);
    expect(rest(HELD_TOP)).toBe(0);
    expect(presence(HELD_TOP)).toBe(1);
  });

  it('cancels the scroll while the head is meant to stay above the heading', () => {
    /*
     * Reported: the mark was carried off the top of the window the moment
     * About settled -- so the one frame the whole handover had been building
     * toward was the frame it disappeared on. It is held there instead.
     */
    for (const past of [40, 100, H * CUE_REST_SCREENS]) {
      expect(rest(HELD_TOP + past)).toBe(past);
      expect(presence(HELD_TOP + past)).toBe(1);
    }
  });

  it('lets go once the copy has taken over, and no later', () => {
    const limit = H * (CUE_REST_SCREENS + CUE_FADE_SCREENS);
    expect(rest(HELD_TOP + limit)).toBeCloseTo(limit, 6);
    expect(rest(HELD_TOP + limit + 4000)).toBeCloseTo(limit, 6);
  });

  it('eases away over the stretch where About\'s own copy arrives', () => {
    const rested = H * CUE_REST_SCREENS;
    const half = rested + (H * CUE_FADE_SCREENS) / 2;

    expect(presence(HELD_TOP + half)).toBeGreaterThan(0);
    expect(presence(HELD_TOP + half)).toBeLessThan(1);
    expect(presence(HELD_TOP + rested + H * CUE_FADE_SCREENS)).toBe(0);
  });

  it('never brightens again once it has started going', () => {
    let previous = 2;
    for (let i = 0; i <= 40; i += 1) {
      const value = presence(HELD_TOP + (i / 40) * H * 0.4);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('stays put and present on a measurement it cannot use', () => {
    expect(cueRest(Number.NaN, HELD_TOP, H)).toBe(0);
    expect(cueRest(-500, HELD_TOP, 0)).toBe(0);
    expect(cuePresence(Number.NaN, HELD_TOP, H)).toBe(1);
    expect(cuePresence(-500, HELD_TOP, 0)).toBe(1);
  });
});
