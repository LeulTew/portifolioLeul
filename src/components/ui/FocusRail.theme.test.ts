import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';

const css = postcss.parse(readFileSync(resolve('src', 'components', 'ui', 'FocusRail.module.css'), 'utf8'));

function palette(selector: string) {
  const values: Record<string, string> = {};
  css.walkRules(rule => {
    if (rule.selector === selector) rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
  });
  return values;
}

function luminance(hex: string) {
  const values = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

it.each(['.rail', '.light'])('%s keeps text, muted notes and source links readable on its opaque reading surface', selector => {
  const values = { ...palette('.rail'), ...palette(selector) };
  const background = luminance(values['--rail-paper']);
  for (const token of ['--rail-ink', '--rail-muted', '--rail-accent']) {
    const foreground = luminance(values[token]);
    expect((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05))
      .toBeGreaterThanOrEqual(4.5);
  }
  expect(palette('.reading').background).toBe('var(--rail-paper)');
});
