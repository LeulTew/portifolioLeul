import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCells, getGridConfig } from './pixelRise';

/**
 * The background transition is a wall of pixels climbing the screen, and every
 * way it has been broken so far has been silent: the beat ran to completion, on
 * time, with every cell doing what its threshold said, and nothing looked like
 * it was rising.
 *
 * These pin the three things that have to hold for the climb to be a climb.
 */

const DESKTOP = getGridConfig(1440, 900);

describe('the pixel grid', () => {
  it('keeps its cells square, which is what makes them read as pixels', () => {
    /*
     * The reference is 10 columns of 134.5px SQUARE cells. Rows are not chosen
     * independently -- the grid stretches them to fill the container, so the
     * row count has to be the one that comes out square, or the stretch turns
     * every cell into a letterbox and the CSS never learns what shape was
     * intended. Asking for a flatter cell here is what did exactly that.
     */
    const cellWidth = 1440 / DESKTOP.cols;
    const cellHeight = 900 / DESKTOP.rows;
    expect(cellWidth / cellHeight).toBeGreaterThan(0.8);
    expect(cellWidth / cellHeight).toBeLessThan(1.25);
  });

  it('uses about as many columns as the reference does', () => {
    expect(DESKTOP.cols).toBe(10);
  });

  it('stays small enough to be cheap, since every cell is drawn twice', () => {
    // Once as a positioned span, once as a rect inside the SVG cutout mask.
    expect(DESKTOP.cols * DESKTOP.rows).toBeLessThanOrEqual(220);
  });

  it('keeps a usable grid on the narrowest supported width', () => {
    const narrow = getGridConfig(768, 1024);
    expect(narrow.cols).toBeGreaterThan(0);
    expect(narrow.rows).toBeGreaterThanOrEqual(6);
  });
});

describe('the order the cells light in', () => {
  const cells = generateCells(DESKTOP.cols, DESKTOP.rows);
  const rows = DESKTOP.rows;

  const band = (row: number) => {
    const thresholds = cells.filter((c) => c.row === row).map((c) => c.threshold);
    return { min: Math.min(...thresholds), max: Math.max(...thresholds) };
  };

  it('starts at the bottom and finishes at the top', () => {
    const order = [...cells].sort((a, b) => a.threshold - b.threshold);
    expect(order[0].row).toBe(rows - 1);
    expect(order[order.length - 1].row).toBe(0);
  });

  it('never lets a row overtake one more than two rows beneath it', () => {
    /*
     * This is the property that makes it a rise rather than speckle, and the
     * one the previous arithmetic did not have.
     *
     * It mixed a 0.68-weighted row position with up to 0.22 of noise while one
     * row was only worth 0.097 of the range -- so a cell near the top could
     * light before cells two and three rows below it, and what the eye saw was
     * blocks appearing all over the screen rather than a line travelling up it.
     *
     * Two rows of interleave ARE allowed, because that is what the reference
     * does: its row means step by ~0.035s while each row spreads ~0.08s, so a
     * little over two rows are in flight at any moment. That overlap is the
     * ragged edge; without it the wall arrives as a stack of flat lines.
     */
    for (let upper = 0; upper < rows; upper++) {
      for (let lower = upper + 3; lower < rows; lower++) {
        expect(band(upper).min).toBeGreaterThan(band(lower).max);
      }
    }
  });

  it('does interleave neighbouring rows, so the edge is ragged', () => {
    let interleaved = 0;
    for (let row = 0; row < rows - 1; row++) {
      if (band(row).min < band(row + 1).max) interleaved++;
    }
    expect(interleaved).toBeGreaterThan(0);
  });

  it('spends the whole beat, with no dead time at either end', () => {
    // Normalised from the values actually produced: anything short of the full
    // range is a slice of the movement where nothing visibly happens.
    const thresholds = cells.map((c) => c.threshold);
    expect(Math.min(...thresholds)).toBe(0);
    expect(Math.max(...thresholds)).toBe(1);
  });

  it('scatters per cell rather than per column', () => {
    /*
     * The reference's column means are flat -- 0.228 to 0.236 across ten
     * columns -- so its scatter carries no column bias at all. A column that
     * consistently led its neighbours would read as vertical banding, which is
     * a different effect from the one being copied.
     *
     * The tolerance is loose because six cells per column is a small sample and
     * some spread is just that; what it rules out is systematic bias.
     */
    const mean = (col: number) => {
      const own = cells.filter((c) => c.col === col);
      return own.reduce((sum, c) => sum + c.threshold, 0) / own.length;
    };
    const means = Array.from({ length: DESKTOP.cols }, (_, col) => mean(col));
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.2);
  });

  it('does not band diagonally', () => {
    /*
     * `(r * a + c * b) % n` is a plane, and a plane sampled on a grid produces
     * visible diagonal stripes. The hash exists to avoid that, so neighbouring
     * cells in a row must not march in step.
     */
    const row = DESKTOP.rows - 1;
    const along = cells.filter((c) => c.row === row).map((c) => c.threshold);
    const deltas = along.slice(1).map((t, i) => t - along[i]);
    const signs = new Set(deltas.map((d) => Math.sign(d)));
    expect(signs.size).toBeGreaterThan(1);
  });
});

describe('the About stylesheet', () => {
  /*
   * Comments are stripped first. The notes in this stylesheet name the very
   * attributes these cases forbid -- explaining why they are forbidden -- and a
   * parser that kept them would read the explanation as the offence.
   */
  const css = readFileSync(join(__dirname, 'About.module.css'), 'utf-8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );

  /**
   * The declarations of every rule whose selector list mentions `selector` and
   * whose body mentions `declaration`.
   *
   * Matching on both is what makes this specific: `.heldGround` and
   * `.heldHeader` each carry several rules, and the one that matters here is
   * identified by what it sets, not by where it happens to appear in the file.
   */
  const bodiesOf = (selector: string, declaration: string) => {
    const found: { selectors: string; body: string }[] = [];
    let cursor = 0;
    while (cursor < css.length) {
      const open = css.indexOf('{', cursor);
      if (open === -1) break;
      const close = css.indexOf('}', open);
      if (close === -1) break;
      const previous = css.lastIndexOf('}', open);
      const selectors = css.slice(previous + 1, open);
      const body = css.slice(open + 1, close);
      if (selectors.includes(selector) && body.includes(declaration)) {
        found.push({ selectors, body });
      }
      cursor = close + 1;
    }
    if (found.length !== 1) {
      throw new Error(
        `expected exactly one "${selector}" rule setting "${declaration}", found ${found.length}`
      );
    }
    return found[0];
  };

  it('does not paint the ground green while the pixels are still climbing', () => {
    /*
     * `data-bg-active` is set on the first frame of the transition and stays
     * set for its whole two seconds. Painting the held ground the chapter
     * colour from it turned the entire screen green before a single cell had
     * lit, and the grid then rose green-on-green: the background appeared to
     * snap, and the climb -- which was running perfectly -- was invisible.
     */
    const rule = bodiesOf('.heldGround', 'background: var(--about-chapter-bg)');
    // The offending part is the SELECTOR, not the declaration: it is which
    // states turn the ground green, not what green it turns.
    expect(rule.body).toContain('background: var(--about-chapter-bg)');
    expect(rule.selectors).not.toContain('data-bg-active');
    // And the states that should still reach it.
    expect(rule.selectors).toContain('data-bg-settled');
    expect(rule.selectors).toContain('data-bg-transition');
  });

  it('never forces the held header visible', () => {
    /*
     * The header lives in the pinned overlay, which hides itself with
     * `visibility: hidden` when the pin releases. `visibility` is inherited,
     * but a descendant declaring `visible` shows through a hidden ancestor --
     * and every selector on this rule keys on `data-bg-transition`, which stays
     * set for the rest of the page. The heading, reading "Education" by then,
     * was pinned on top of Skills, Projects and Contact.
     *
     * The overlay owns whether the held content is on screen. Nothing else may.
     */
    const rule = bodiesOf('.heldHeader', 'opacity: 1 !important');
    expect(rule.body).toContain('transform: none');
    expect(rule.body).not.toContain('visibility');
  });
});
