import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

describe('scroll entrance property ownership', () => {
  it.each([
    ['Skills', '.chapter'],
    ['Skills', '.instrumentTilt'],
    ['Contact', '.formContainer'],
  ])('%s %s leaves per-frame transform and opacity to its animation owner', (section, selector) => {
    const css = postcss.parse(readFileSync(join(__dirname, section, `${section}.module.css`), 'utf8'));
    const properties: string[] = [];
    let matched = false;
    css.walkRules(selector, (rule) => {
      matched = true;
      rule.walkDecls(/^transition(?:-property)?$/, (declaration) => {
        properties.push(...postcss.list.comma(declaration.value).map((part) => part.trim().split(/\s+/)[0]));
      });
      expect(matched).toBe(true);
    });
    expect(properties).not.toContain('all');
    expect(properties).not.toContain('transform');
    expect(properties).not.toContain('opacity');
    if (section === 'Contact') expect(properties).toContain('border-color');
  });
});
