import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from './contrast';
import { groundFor, groundSections } from '@/components/ui/GroundWash';

/**
 * The held sections stand on a ground that turns near-white in the light
 * theme, so anything in them written as literal white is painted onto white.
 *
 * A component test cannot see this -- it renders, it just cannot be read --
 * and the page reports nothing. So it is asserted against the stylesheets: a
 * rule that sets a white-ish colour must have a `[data-theme='light']`
 * counterpart for the same selector, or use a token that already follows the
 * theme.
 */
const ROOT = join(__dirname, '..', '..');

const SHEETS = [
  'components/sections/About/About.module.css',
  'components/sections/Education/Education.module.css',
  'components/ui/TypedText/TypedText.module.css',
  'components/ui/HeldBackdrop/HeldBackdrop.module.css',
  'components/ui/ScrollCue/ScrollCue.module.css',
];

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

interface Rule {
  selectors: string[];
  body: string;
}

/** Every rule in the sheet, at any nesting depth. */
function rules(source: string): Rule[] {
  const found: Rule[] = [];
  const text = withoutComments(source);
  let depth = 0;
  let head = '';
  let body = '';

  for (const char of text) {
    if (char === '{') {
      depth += 1;
      body = '';
      continue;
    }

    if (char === '}') {
      if (depth >= 1 && !head.trim().startsWith('@')) {
        found.push({
          selectors: head.split(',').map((part) => part.trim()).filter(Boolean),
          body,
        });
      }
      depth = Math.max(depth - 1, 0);
      head = '';
      continue;
    }

    if (depth === 0) head += char;
    else body += char;
  }

  return found;
}

/** A literal white, as opposed to a token that follows the theme. */
function paintsWhite(body: string): boolean {
  const colour = /(?:^|[;\s])color:\s*([^;]+)/.exec(body);
  if (!colour) return false;

  const value = colour[1].trim().toLowerCase();
  if (value.startsWith('var(')) return false;
  if (/#fff\b|#ffffff\b/.test(value)) return true;
  return /rgba?\(\s*2[45]\d\s*,\s*2[45]\d\s*,\s*2[45]\d/.test(value);
}

/** The class name a selector ends on, which is what a light rule overrides. */
const tail = (selector: string) => selector.slice(selector.lastIndexOf('.'));

describe('light theme coverage', () => {
  for (const sheet of SHEETS) {
    it(`gives every white it paints a light counterpart in ${sheet}`, () => {
      const parsed = rules(readFileSync(join(ROOT, sheet), 'utf-8'));

      const lightened = new Set(
        parsed
          .filter((rule) => rule.selectors.some((s) => s.includes("data-theme='light'")))
          .flatMap((rule) => rule.selectors)
          .map(tail)
      );

      const stranded = parsed
        .filter((rule) => !rule.selectors.some((s) => s.includes('data-theme')))
        .filter((rule) => paintsWhite(rule.body))
        .flatMap((rule) => rule.selectors)
        .filter((selector) => !lightened.has(tail(selector)));

      expect(stranded, 'white with nowhere to go in the light theme').toEqual([]);
    });
  }

  it('routes the accent through a token rather than repeating the hex', () => {
    // Written literally it cannot follow the theme, and #00ff9d on a near-white
    // ground is about 1.3:1 -- legible in one theme, invisible in the other.
    for (const sheet of SHEETS) {
      const css = withoutComments(readFileSync(join(ROOT, sheet), 'utf-8'));
      const bare = [...css.matchAll(/#00ff(?:9d|c2)\b/gi)].filter((match) => {
        const before = css.slice(Math.max(0, (match.index ?? 0) - 60), match.index);
        // Allowed as a fallback inside var(), which the token overrides.
        return !/var\(--[\w-]+,\s*$/.test(before);
      });

      expect(bare.map((m) => m[0]), `bare accent in ${sheet}`).toEqual([]);
    }
  });
});

describe('light accent contrast', () => {
  /** Read from the stylesheet, so the test cannot drift from the token. */
  const lightBlock = readFileSync(join(ROOT, 'index.css'), 'utf-8').slice(
    readFileSync(join(ROOT, 'index.css'), 'utf-8').indexOf('[data-theme="light"]')
  );
  const accentInk = /--accent-ink:\s*(#[0-9a-f]{6})/i.exec(lightBlock)![1];

  it('reads as ink on every light ground, not just the lightest one', () => {
    // An accent chosen against the palest ground can fail on a darker one a
    // few percent away, and the page says nothing about it. The accent carries
    // the smallest text in Education, so it is held to the normal-text bar.
    for (const section of groundSections()) {
      const ground = groundFor(section, 'light').base;
      expect(
        contrastRatio(accentInk, ground),
        `accent on ${section}'s light ground`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is far darker than the accent it replaces', () => {
    const bright = '#00ff9d';
    const ground = groundFor('about', 'light').base;
    expect(contrastRatio(bright, ground)).toBeLessThan(2);
    expect(contrastRatio(accentInk, ground)).toBeGreaterThan(
      contrastRatio(bright, ground)
    );
  });
});
