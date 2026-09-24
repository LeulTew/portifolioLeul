import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule } from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(resolve('src', 'index.css'), 'utf8'));

function declarations(selector: string, within?: AtRule): Record<string, string> {
  const values: Record<string, string> = {};
  (within ?? css).each(node => {
    if (node.type !== 'rule' || node.selector !== selector) return;
    node.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  });
  return values;
}

describe('global document styles', () => {
  it('scrolls the document smoothly only for readers who have not asked for less motion', () => {
    expect(declarations('html')['scroll-behavior']).toBe('smooth');
    const reduced = css.nodes.find((node): node is AtRule => node.type === 'atrule' &&
      node.name === 'media' && node.params === '(prefers-reduced-motion: reduce)');
    // Measured natively: Flat Tab focus still glided 9,300px under reduced motion without this.
    expect(reduced).toBeDefined();
    expect(declarations('html', reduced)['scroll-behavior']).toBe('auto');
  });
});
