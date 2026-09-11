import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The title beat is written as three phases with hard boundaries, and a phase
 * boundary is where a glitch lives: whatever phase N leaves on screen, phase
 * N+1 has to pick up at exactly that value or the frame at the boundary is a
 * jump. Both directions, because the beat reverses.
 *
 * These reproduce the boundary arithmetic rather than driving the component,
 * because the component writes to `style.opacity` and `dataset.active` from
 * inside a `requestAnimationFrame` loop -- which jsdom will happily run, but
 * only after a real frame, and the thing under test is a single frame's worth
 * of discontinuity.
 */

const PHASE_ONE_END = 0.45;
const PHASE_TWO_END = 0.82;

/** Phase one: the old heading dissolving. */
const titleOpacityPhaseOne = (p: number) =>
  Math.max(0, 1 - ((p - 0.02) / 0.43) * 1.8);

/** Phase two: the new heading being written. */
const titleOpacityPhaseTwo = (p: number) => (p - PHASE_ONE_END) / 0.37;

/** Phase two: which dots are lit. */
const dotLitPhaseTwo = (threshold: number, p: number) =>
  threshold >= ((p - PHASE_ONE_END) / 0.37) * 0.4;

/** Phase three: which dots are lit. */
const dotLitPhaseThree = (threshold: number, p: number) =>
  threshold >= 0.4 + Math.min(1, (p - PHASE_TWO_END) / 0.18) * 0.65;

const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

describe('the title beat across its phase boundaries', () => {
  it('meets at nothing where the old heading hands over to the new', () => {
    /*
     * Phase one's ramp reaches zero at p1 = 0.556 and stays there, so the
     * heading is already invisible when phase two begins. Phase two used to
     * open at 0.6 -- more than half opaque in a single frame. Scrolling down
     * that flashed on; scrolling back up it flashed off.
     */
    expect(titleOpacityPhaseOne(PHASE_ONE_END)).toBe(0);
    expect(titleOpacityPhaseTwo(PHASE_ONE_END)).toBe(0);
  });

  it('arrives at full strength exactly as the writing phase ends', () => {
    expect(titleOpacityPhaseTwo(PHASE_TWO_END)).toBeCloseTo(1, 5);
  });

  it('does not relight a single dot when the clearing phase takes over', () => {
    /*
     * The sparkle. Phase two ends with only the dots above 0.4 lit; phase three
     * used to restart from `p3 < threshold`, which at p3 = 0 lights every dot
     * above zero -- so every dot between 0 and 0.4 flicked back on for one
     * frame, right as the heading was supposed to be resolving.
     */
    for (const threshold of THRESHOLDS) {
      expect(dotLitPhaseThree(threshold, PHASE_TWO_END)).toBe(
        dotLitPhaseTwo(threshold, PHASE_TWO_END)
      );
    }
  });

  it('finishes with every dot cleared, including one sitting on 1.0', () => {
    // `generateDots` clamps with `Math.min(1, ...)`, so 1.0 is reachable and a
    // sweep that stops at 1.0 strands it lit on the finished heading.
    for (const threshold of THRESHOLDS) {
      expect(dotLitPhaseThree(threshold, 1)).toBe(false);
    }
  });

  it('only ever clears dots as the last phase runs, never lights them', () => {
    // Monotonic: a dot that has gone out must not come back.
    for (const threshold of THRESHOLDS) {
      let previous = dotLitPhaseThree(threshold, PHASE_TWO_END);
      for (let p = PHASE_TWO_END; p <= 1.0001; p += 0.01) {
        const now = dotLitPhaseThree(threshold, p);
        expect(now && !previous).toBe(false);
        previous = now;
      }
    }
  });
});

describe('the title stylesheet', () => {
  const css = readFileSync(
    join(__dirname, 'TitlePixelTransition.module.css'),
    'utf-8'
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  const bodyOf = (selector: string) => {
    const at = css.indexOf(selector + ' {');
    if (at === -1) throw new Error(`no rule for ${selector}`);
    const open = css.indexOf('{', at);
    return css.slice(open + 1, css.indexOf('}', open));
  };

  it.each(['.title', '.subtitle'])(
    'does not transition %s opacity, which the beat writes every frame',
    (selector) => {
      /*
       * A CSS transition on a property that JavaScript rewrites every frame is
       * a second animation racing the first: each frame retargets the ease
       * before it has arrived, so the rendered value lags by the transition's
       * duration and never lands on what the beat computed. On a headline this
       * size it reads as the text smearing rather than fading.
       */
      expect(bodyOf(selector)).not.toMatch(/transition:[^;]*opacity/);
    }
  );

  it('keeps the transition on the dots, which are switched discretely', () => {
    // There the transition IS the animation, not a competitor to one.
    expect(bodyOf('.pixelDot')).toMatch(/transition:[^;]*opacity/);
  });
});
