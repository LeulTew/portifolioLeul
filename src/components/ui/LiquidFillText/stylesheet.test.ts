import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two failure modes in this stylesheet have no runtime signal at all, so they
 * are asserted against the source.
 *
 * The first is scope. The snowfall and the fill live on different elements: the
 * fields are `.word::before` and `.word::after`, the drift is `.char`. A colour
 * declared only on `.char` is unset where a field uses it -- and an unresolved
 * var() inside `background-image` invalidates the whole declaration, so the
 * layer computes to `none` and no snow renders. No console error, no build
 * warning, every other test still green.
 *
 * The second is the surface standing on the body rather than inside it, which
 * is the difference between a liquid edge and a flat one.
 */
const css = readFileSync(join(__dirname, 'LiquidFillText.module.css'), 'utf-8');

/** Comments here are long enough to be mistaken for selectors. */
function withoutComments(source: string): string {
  let out = '';
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf('/*', index);
    if (open === -1) return out + source.slice(index);
    out += source.slice(index, open);
    const close = source.indexOf('*/', open + 2);
    if (close === -1) return out;
    index = close + 2;
  }

  return out;
}

/**
 * Top-level rules only, keyed by selector.
 *
 * The `@supports` and `@media (prefers-reduced-motion)` blocks at the end
 * redeclare the same selectors to switch the effect off. Folding those
 * overrides into the rule being asserted would let a rule pass on the strength
 * of its own fallback.
 */
function topLevelRules(source: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let depth = 0;
  let head = '';
  let body = '';

  for (const char of withoutComments(source)) {
    if (char === '{') {
      depth += 1;
      if (depth === 1) body = '';
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && !head.trim().startsWith('@')) {
        for (const selector of head.split(',').map((part) => part.trim())) {
          if (!selector) continue;
          rules.set(selector, [...(rules.get(selector) ?? []), body]);
        }
      }
      if (depth <= 0) {
        depth = 0;
        head = '';
      }
      continue;
    }

    if (depth === 0) head += char;
    else if (depth === 1) body += char;
  }

  return rules;
}

const RULES = topLevelRules(css);

/**
 * Every top-level rule body whose selector list includes `selector`.
 *
 * All of them, not the first: the two fields share a grouped block for what
 * they have in common and take a block each for what they do not, so a
 * property can legitimately live in either.
 */
function ruleBody(selector: string): string {
  const bodies = RULES.get(selector);
  expect(bodies, `no rule for ${selector}`).toBeDefined();
  return bodies!.join('\n');
}

function propertiesRead(body: string): string[] {
  return [...body.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
}

describe('LiquidFillText stylesheet', () => {
  it('declares every custom property the snowfields read', () => {
    const used = propertiesRead(
      ruleBody('.word::before') + ruleBody('.word::after')
    );
    const declared = ruleBody('.word');

    expect(used.length).toBeGreaterThan(0);
    for (const property of used) {
      expect(declared, `${property} is unset on .word`).toContain(`${property}:`);
    }
  });

  it('declares every custom property the letters read', () => {
    const glyph = ruleBody('.char');
    const word = ruleBody('.word');

    for (const property of propertiesRead(glyph)) {
      const resolves =
        glyph.includes(`${property}:`) || word.includes(`${property}:`);
      expect(resolves, `${property} is unset`).toBe(true);
    }
  });

  it('bounds the snowfields, so a wrapped word cannot fill the screen', () => {
    expect(ruleBody('.word::before')).toMatch(/height:\s*min\(/);
  });

  it('stands the surface above the body at every level', () => {
    // Scallops drawn inside the body's own box land on pixels the body has
    // already painted: perfectly attached, completely invisible, edge stays
    // flat. Every surface layer must be the body's height plus a lift.
    const lifts = [...ruleBody('.char').matchAll(/calc\((\d+)% \+ (\d+)px\)/g)];

    expect(lifts.length).toBeGreaterThan(0);
    for (const [, , lift] of lifts) {
      expect(Number(lift)).toBeGreaterThan(0);
    }
  });
});
