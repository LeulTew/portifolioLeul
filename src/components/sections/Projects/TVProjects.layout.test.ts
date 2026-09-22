import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type Container, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(resolve(
  'src', 'components', 'sections', 'Projects', 'TVProjects.module.css',
), 'utf8'));
const compact = css.nodes.find(node => node.type === 'atrule' &&
  node.name === 'container' && node.params === '(max-height: 320px)') as Container;
const reader = ".stage[data-staged='true'] .display[data-details='true']";

function rule(selector: string, container: Container = css): Rule {
  const node = container.nodes?.find(item => item.type === 'rule' && item.selector === selector);
  if (!node || node.type !== 'rule') throw new Error(`Missing layout rule: ${selector}`);
  return node;
}

function value(selector: string, property: string, container: Container = compact): string {
  const declaration = rule(selector, container).nodes.find(node =>
    node.type === 'decl' && node.prop === property);
  if (!declaration || declaration.type !== 'decl') throw new Error(`Missing ${selector} ${property}`);
  return declaration.value;
}

describe('compact TV Details reading budget', () => {
  it('responds to aperture height and consolidates the same header and escape control into one row', () => {
    expect(compact).toBeDefined();
    expect(value(reader, 'grid-template-rows')).toBe('48px minmax(0, 1fr)');
    expect(value(`${reader} .displayHeader`, 'grid-area')).toBe('1 / 1');
    expect(value(`${reader} .displayFooter`, 'grid-area')).toBe('1 / 2');
    expect(value(`${reader} .work`, 'grid-area')).toBe('2 / 1 / 3 / -1');
    expect(value(`${reader} .displayHeader`, 'padding')).toBe('0');
    expect(value(`${reader} .displayFooter`, 'padding')).toBe('0');
    expect(value(`${reader} .work`, 'padding')).toBe('0');
  });

  it('budgets at least 150px for text inside the measured 900×560 aperture without shrinking body type', () => {
    // The review measured a 228.334px aperture and only 97px for the old reader.
    const apertureHeight = 228.334;
    const padding = value(reader, 'padding').split(' ');
    expect(padding).toEqual(['4px', '12px', '6px']);
    const headerHeight = Number.parseFloat(value(reader, 'grid-template-rows'));
    const rowGap = Number.parseFloat(value(reader, 'gap'));
    const dividerHeight = Number.parseFloat(value(`${reader} .work`, 'border-top'));
    const textInset = Number.parseFloat(value(`${reader} .copy`, 'padding-top'));
    const textHeight = apertureHeight - Number.parseFloat(padding[0]) - Number.parseFloat(padding[2])
      - headerHeight - rowGap - dividerHeight - textInset;
    expect(textHeight).toBeGreaterThanOrEqual(150);
    expect(value('.copy', 'font-size', css)).toMatch(/^clamp\(14px,/);
    expect(value(`${reader} .technology`, 'font-size')).toBe('14px');
  });

  it('keeps native scrolling, the original aperture, and the existing controls', () => {
    expect(value('.copy', 'overflow-y', css)).toBe('auto');
    expect(value('.copy', 'overscroll-behavior', css)).toBe('contain');
    expect(value(`${reader} .copy`, 'scrollbar-gutter')).toBe('stable');
    for (const selector of [reader, `${reader} .displayFooter`, `${reader} .copy`]) {
      const declarations = rule(selector, compact).nodes.filter(node => node.type === 'decl');
      expect(declarations.some(node => ['position', 'transform', 'width', 'height', 'display'].includes(node.prop)))
        .toBe(false);
    }
  });
});
