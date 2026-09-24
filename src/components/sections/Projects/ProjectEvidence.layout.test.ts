import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { expect, it } from 'vitest';

const css = postcss.parse(readFileSync(resolve(
  'src', 'components', 'sections', 'Projects', 'ProjectEvidence.module.css',
), 'utf8'));

function declarations(selector: string) {
  const values: Record<string, string> = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  });
  return values;
}

it('keeps a provenance note clear of the Full image link focus ring', () => {
  const focus = declarations('.visualLink:focus-visible');
  const ring = Number.parseFloat(focus.outline) + Number.parseFloat(focus['outline-offset']);
  expect(ring).toBe(5);
  expect(declarations('.visualLink')['min-height']).toBe('48px');
  expect(Number.parseFloat(declarations('.visualLink + .visualNote')['margin-top'])).toBeGreaterThan(ring);
});
