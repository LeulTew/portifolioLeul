import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

describe('scroll entrance property ownership', () => {
  it.each([
    ['Skills', '.skillCard'],
    ['Skills', '.skill'],
    ['Contact', '.formContainer'],
  ])('%s %s leaves the per-frame transform and opacity to Motion', (section, selector) => {
    const css = postcss.parse(readFileSync(join(__dirname, section, `${section}.module.css`), 'utf8'));
    const properties: string[] = [];
    css.walkRules(selector, (rule) => {
      rule.walkDecls(/^transition(?:-property)?$/, (declaration) => {
        properties.push(...postcss.list.comma(declaration.value).map((part) => part.trim().split(/\s+/)[0]));
      });
    });
    expect(properties).not.toContain('all');
    expect(properties).not.toContain('transform');
    expect(properties).not.toContain('opacity');
    expect(properties).toContain('border-color');
  });
});
