import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

describe('scroll entrance property ownership', () => {
  it.each([
    ':global(main[inert]) .tracerBeam',
    ':global([data-education-covered]) .tracerBeam',
    ':global([data-skills-covered]) .tracerBeam',
  ])('pauses covered button tracers through %s', selector => {
    const css = postcss.parse(readFileSync(join(__dirname, '..', 'ui', 'MagneticButton.module.css'), 'utf8'));
    const states: string[] = [];
    css.walkRules(rule => {
      if (!rule.selectors.includes(selector)) return;
      rule.walkDecls('animation-play-state', declaration => { states.push(declaration.value); });
    });
    expect(states).toEqual(['paused']);
  });

  it.each([
    ['Skills', 'Skills', '.chapter'],
    ['Skills', 'Skills', '.instrumentTilt'],
    ['Contact', 'Contact', '.formContainer'],
    ['Contact', 'ContactForm', '.sheet'],
    ['Contact', 'ContactForm', '.form'],
  ])('%s %s %s leaves per-frame transform and opacity to its animation owner', (section, file, selector) => {
    const css = postcss.parse(readFileSync(join(__dirname, section, `${file}.module.css`), 'utf8'));
    const properties: string[] = [];
    let matched = false;
    css.walkRules(selector, (rule) => {
      matched = true;
      rule.walkDecls(/^transition(?:-property)?$/, (declaration) => {
        properties.push(...postcss.list.comma(declaration.value).map((part) => part.trim().split(/\s+/)[0]));
      });
    });
    if (section === 'Contact') expect(matched).toBe(true);
    expect(properties).not.toContain('all');
    expect(properties).not.toContain('transform');
    expect(properties).not.toContain('opacity');
    if (selector === '.form') expect(properties).toContain('border-color');
  });
});
