import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(resolve('src', 'index.css'), 'utf8'));

describe('global document styles', () => {
  it('reveals keyboard focus instantly instead of gliding the document to it', () => {
    // Measured natively in the no-WebGL page: with a document-wide smooth scroll,
    // each Tab glided up to 10,000px and left focus offscreen for about 1.5s.
    const behaviours: string[] = [];
    css.walkRules(rule => {
      if (!rule.selectors.some(selector => /^(html|:root|body)$/.test(selector.trim()))) return;
      rule.walkDecls('scroll-behavior', declaration => { behaviours.push(declaration.value); });
    });
    expect(behaviours.filter(value => value !== 'auto')).toEqual([]);
  });
});
