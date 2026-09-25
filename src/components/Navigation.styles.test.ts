import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(join(__dirname, 'Navigation.module.css'), 'utf8'));

/** The value `selector`'s last rule sets for `property`, outside media queries. */
function cascaded(selector: string, property: string): string | undefined {
  let value: string | undefined;
  css.walkRules(rule => {
    if (rule.parent?.type === 'atrule' || !rule.selectors.includes(selector)) return;
    rule.walkDecls(property, declaration => { value = declaration.value; });
  });
  return value;
}

describe('the navigation bar hit area', () => {
  it('takes the pointer only where a control can be seen', () => {
    // Round 8 (D-HIT-001): at 3840x2160 the transparent bar swallowed clicks on the TV's category tabs.
    expect(cascaded('.header', 'pointer-events')).toBe('none');
    expect(cascaded('.logo', 'pointer-events')).toBe('auto');
    expect(cascaded('.navBar', 'pointer-events')).toBe('auto');
  });

  it('keeps the painted copy of the bar out of the way entirely', () => {
    const rules = css.nodes.filter(node => node.type === 'rule' && node.selectors.includes('.painted *'));
    expect(rules).toHaveLength(1);
    const painted = rules[0];
    // Later in the file than the controls' own rules, so it wins at equal specificity.
    const controls = css.nodes.findIndex(node => node.type === 'rule' && node.selectors.includes('.navBar'));
    expect(css.nodes.indexOf(painted)).toBeGreaterThan(controls);
    expect(painted.type === 'rule' && painted.nodes.some(node => node.type === 'decl' && node.prop === 'pointer-events' && node.value === 'none')).toBe(true);
  });
});
