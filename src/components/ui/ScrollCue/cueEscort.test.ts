import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  CUE_FADE_SCREENS,
  CUE_REST_SCREENS,
  CUE_TIP_GAP,
  cueRail,
} from '@/lib/motion/heroPin';
import { STATEMENT_ARRIVE } from '@/components/sections/About/aboutBeats';

/**
 * The mark and the heading make one journey between them.
 *
 * The hero draws a line down the page and its head comes to rest on the name of
 * the next section. That composition is the entire point of the handover, and
 * it only exists while the two agree about where the heading is -- which they
 * stopped doing the moment the heading was given a journey of its own.
 */
describe('the mark aims at where the heading first appears', () => {
  const VIEWPORT = 900;
  const HEADING_HEIGHT = 93;
  const HEAD_LEAD = 99;

  /** The browser's own centring, restated: `top: 50%` less half the height. */
  const centredTop = VIEWPORT / 2 - HEADING_HEIGHT / 2;

  it('puts the head above the centred heading, not the resting one', () => {
    /*
     * `cueRail` answers in the hero section's own space, so the tip lands a
     * fixed gap above the heading measured from where the held stretch begins.
     * What matters here is only which heading position it was aimed at.
     */
    const HELD_TOP = 1200;
    const centred = cueRail(200, HELD_TOP, centredTop, 315, VIEWPORT);
    const resting = cueRail(200, HELD_TOP, HEAD_LEAD, 315, VIEWPORT);

    expect(centred.top + centred.height).toBe(HELD_TOP + centredTop - CUE_TIP_GAP);
    // Aiming at the corner instead would put the head 300-odd pixels wrong.
    expect(centred.top + centred.height).not.toBe(resting.top + resting.height);
    expect(
      centred.top + centred.height - (resting.top + resting.height)
    ).toBeCloseTo(centredTop - HEAD_LEAD, 10);
  });

  it('cannot reach the resting position by reading the stylesheet', () => {
    /*
     * The regression this whole approach exists for.
     *
     * The first escort interpolated between the centred position and the
     * resting one, reading the latter with
     * `parseFloat(style.getPropertyValue('--head-lead'))`. Custom properties
     * are unregistered here, so the computed value of that property is the
     * `clamp(...)` token verbatim -- `parseFloat` returns `NaN`, the `|| 0`
     * beside it turned that into a landing point of zero, and the mark walked
     * a hundred pixels further than the heading did. Measured: heading 377 ->
     * 99, head 341 -> -36, gap 36 -> 135.
     *
     * So this asserts the number is genuinely unavailable that way, which is
     * what makes reading the live heading the only correct option rather than
     * a matter of taste.
     */
    const css = readFileSync(
      join(__dirname, '../../sections/About/About.module.css'),
      'utf-8'
    );
    const declared = /--head-lead:\s*([^;]+);/.exec(css)?.[1].trim();

    expect(declared).toBeTruthy();
    expect(Number.parseFloat(declared as string)).toBeNaN();
  });

  it('is composited from the published displacement of the heading', () => {
    /*
     * The escort is CSS, not JavaScript, and this is why.
     *
     * The JavaScript version read the heading's rect from the hero's frame
     * callback, which is a different callback from the one that moves the
     * heading. Whenever the hero's ran first it positioned the mark from the
     * heading's PREVIOUS position, and a frame of that climb is several
     * pixels: measured on the way back down, the gap breathed between 19px and
     * 41px around a nominal 36.
     *
     * So the heading publishes `--head-offset` in the same breath as the write
     * that moved it, and the mark adds it in `top`. Both are then resolved from
     * one value at paint, and callback order stops mattering -- which is a
     * property of the stylesheet, so the stylesheet is what this checks.
     */
    const css = readFileSync(
      join(__dirname, '../../sections/Home/Home.module.css'),
      'utf-8'
    );
    const cue = css.slice(css.indexOf('.scrollCue {'));
    const decl = cue.slice(cue.indexOf('top:'));
    const top = decl.slice(0, decl.indexOf(';'));

    expect(top).toContain('--cue-y');
    expect(top).toContain('--head-offset');
    // Absent before About mounts, and zero while the heading is still centred.
    expect(top).toContain('--head-offset, 0px');
  });

  it('publishes that displacement from the heading that moved', () => {
    /*
     * And the publisher is the heading itself -- the only thing that knows
     * both that it moved and where it moved to on this frame.
     */
    const about = readFileSync(
      join(__dirname, '../../sections/About/About.tsx'),
      'utf-8'
    );
    const held = about.slice(about.indexOf('function HeldHeader'));

    expect(held).toContain("'--head-offset'");
    // Written off a live rect, not interpolated towards a resting place.
    expect(held).toContain('getBoundingClientRect().top');
    // And only on frames that moved, because this runs in the render loop.
    expect(/if \(moved\) \{/.test(held)).toBe(true);
  });
});

describe('the mark stays for the whole journey it is escorting', () => {
  it('rests past the point the copy used to arrive at', () => {
    /*
     * It used to let go a fourteenth of the way into the held stretch, which
     * was matched to the copy arriving. The copy now waits for the heading to
     * finish travelling, so letting go there would abandon the heading
     * mid-climb -- the mark disappearing during the one movement it exists to
     * accompany.
     */
    expect(CUE_REST_SCREENS).toBeGreaterThan(STATEMENT_ARRIVE.enter);
  });

  it('leaves slowly enough to read as leaving', () => {
    expect(CUE_FADE_SCREENS).toBeGreaterThan(0.1);
    // But not so slowly that it is still going when the statements settle.
    expect(CUE_REST_SCREENS + CUE_FADE_SCREENS).toBeLessThan(0.5);
  });
});
