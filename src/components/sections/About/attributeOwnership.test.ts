import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * One author per flag.
 *
 * Rule 1 says a beat asks one question to decide whether it is running. At the
 * level of the DOM the same thing holds for the attributes those beats publish:
 * two components writing one flag agree nowhere except by accident, and the
 * disagreement is a visible frame.
 *
 * The bug: an `IntersectionObserver` on the Education rail set
 * `data-bg-transition` and `data-navbar-contrary` the moment the rail touched
 * the viewport. Measured, that happened at `seq` 0.549 -- with the background's
 * threshold at 0.78 and its precondition unset -- and the background's own
 * frame loop stripped the flag back off 8ms later. One frame, but that flag
 * decides the statements' ink, is watched by the footer, and lives on `#about`
 * where `body:has(...)` selectors watch it, so the frame is a document-wide
 * restyle and a twitch of the chapter's colour a third of the way in.
 *
 * Source text rather than behaviour, because the property is "nobody else
 * writes this" -- which is a statement about every other file, and cannot be
 * observed from any one of them at runtime.
 */

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, ...parts), 'utf-8');

/** Strips block and line comments, so prose about a flag is not a write. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const writesTo = (src: string, attribute: string) => {
  const body = code(src);
  const quoted = `'${attribute}'`;
  return (
    body.includes(`setAttribute(${quoted}`) ||
    body.includes(`removeAttribute(${quoted}`) ||
    body.includes(`writeAttribute(about, ${quoted}`) ||
    body.includes(`writeAttribute(aboutEl, ${quoted}`) ||
    body.includes(`writeAttribute(aboutSection, ${quoted}`)
  );
};

describe('the chapter has one author per flag', () => {
  it.each([
    ['data-bg-transition', 'BackgroundPixelTransition.tsx'],
    ['data-bg-active', 'BackgroundPixelTransition.tsx'],
    ['data-bg-settled', 'BackgroundPixelTransition.tsx'],
    ['data-navbar-contrary', 'BackgroundPixelTransition.tsx'],
  ])('%s is written by %s and not by About.tsx', (attribute, owner) => {
    expect(writesTo(read(owner), attribute)).toBe(true);
    expect(writesTo(read('About.tsx'), attribute)).toBe(false);
  });

  it('data-education-active is the rail\u2019s, not About\u2019s', () => {
    expect(
      writesTo(read('EducationRail', 'useEducationPlayback.ts'), 'data-education-active')
    ).toBe(true);
    expect(writesTo(read('About.tsx'), 'data-education-active')).toBe(false);
  });

  it.each([
    { file: 'About.tsx', owned: ['data-statements-cleared', 'data-statements-present'] },
    { file: 'AboutHeading.tsx', owned: ['data-head-pending', 'data-head-settled', 'data-head-travelling'] },
  ])('$file writes only the flags its own beats decide', ({ file, owned }) => {
    const body = code(read(file));
    const written = new Set(
      [...body.matchAll(/(?:set|remove)Attribute\(\s*'(data-[\w-]+)'/g)]
        .map((m) => m[1])
        .concat(
          [...body.matchAll(/writeAttribute\([^,]+,\s*'(data-[\w-]+)'/g)].map(
            (m) => m[1]
          )
        )
    );

    expect([...written].sort()).toEqual(owned);
  });
});
