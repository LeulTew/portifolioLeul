import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The snowfall and the fill live on different elements: the field is
 * `.word::before`, the drift is `.char`. A colour declared only on `.char` is
 * therefore unset where the field uses it -- and an unresolved `var()` inside
 * `background-image` invalidates the whole declaration, so the layer computes
 * to `none` and no snow renders at all. It fails silently: no console error,
 * no build warning, and every other test still passes.
 */
const css = readFileSync(
  join(__dirname, 'LiquidFillText.module.css'),
  'utf-8'
);

function ruleBody(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
}

describe('LiquidFillText stylesheet', () => {
  it('declares every custom property the snowfield reads', () => {
    const field = ruleBody('.word::before');
    const used = [...field.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
    const declared = ruleBody('.word');

    expect(used.length).toBeGreaterThan(0);
    for (const property of used) {
      expect(declared, `${property} is unset on .word`).toContain(
        `${property}:`
      );
    }
  });

  it('declares every custom property the letters read', () => {
    const glyph = ruleBody('.char');
    const used = [...glyph.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);
    const inherited = ruleBody('.word');

    for (const property of used) {
      // Either declared on the letter itself or inherited from the word.
      const own = glyph.includes(`${property}:`);
      const fromWord = inherited.includes(`${property}:`);
      expect(own || fromWord, `${property} is unset`).toBe(true);
    }
  });

  it('bounds the snowfield, so a wrapped word cannot fill the screen', () => {
    expect(ruleBody('.word::before')).toMatch(/height:\s*min\(/);
  });
});
