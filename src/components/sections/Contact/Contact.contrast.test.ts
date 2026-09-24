import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'postcss';

const themeSheet = parse(readFileSync(resolve('src', 'components', 'sections', 'Contact', 'Contact.module.css'), 'utf8'));
const formSheet = parse(readFileSync(resolve('src', 'components', 'sections', 'Contact', 'ContactForm.module.css'), 'utf8'));

function tokens(selector: string) {
  const result: Record<string, string> = {};
  themeSheet.walkRules(rule => {
    if (rule.selector === selector) rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

function luminance(rgb: number[]) {
  const channels = rgb.map(value => {
    const encoded = value / 255;
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

it.each([
  ['dark', '.contact'],
  ['light', ":global([data-theme='light']) .contact"],
])('%s input boundaries keep 3:1 contrast across the translucent surface bounds', (_theme, selector) => {
  const theme = { ...tokens('.contact'), ...tokens(selector) };
  const boundary = theme['--contact-field-border'] ?? theme['--contact-border'];
  expect(boundary).toMatch(/^#[a-f\d]{6}$/i);
  const foreground = [1, 3, 5].map(offset => parseInt(boundary.slice(offset, offset + 2), 16));
  const surface = theme['--contact-surface'].match(/\d+(?:\.\d+)?/g)!.map(Number);
  expect(surface).toHaveLength(4);
  for (const background of [0, 255]) {
    const composited = surface.slice(0, 3).map(channel => channel * surface[3] + background * (1 - surface[3]));
    const a = luminance(foreground);
    const b = luminance(composited);
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(3);
  }
});

it('uses a dedicated control-boundary token without strengthening every decorative border', () => {
  let boundary: string | undefined;
  formSheet.walkRules(rule => {
    if (rule.selectors.includes('.input') && rule.selectors.includes('.textarea')) {
      rule.walkDecls('border-bottom', declaration => { boundary = declaration.value; });
    }
  });
  expect(boundary).toBe('1px solid var(--contact-field-border)');
});
