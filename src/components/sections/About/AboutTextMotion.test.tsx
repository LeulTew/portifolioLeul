import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { parse, type AnyNode } from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { About } from './About';
import { STATEMENT_ARRIVE, STATEMENT_CLEAR, STATEMENT_SWAP } from './aboutBeats';
import styles from './About.module.css';
import * as scrollContainer from '@/lib/scroll/scrollContainer';
import { cvData } from '@/data/cv';
import { projectsData } from '@/data/projects';

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => preferences.reduced,
}));
vi.mock('./EducationRail/EducationRail', () => ({ EducationRail: () => null }));
vi.mock('../../ui/FocusScrim', () => ({ FocusScrim: () => null }));

const sheet = parse(readFileSync(resolve('src', 'components', 'sections', 'About', 'About.module.css'), 'utf8'));
const presentation = { width: 1440, reduced: false };

function declarations(selectors: string[], mode = presentation) {
  const result: Record<string, string> = {};
  sheet.walkRules(rule => {
    if (!rule.selectors.some(selector => selectors.includes(selector))) return;
    for (let parent: AnyNode | undefined = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'media') continue;
      const media = parent.params;
      if (media.includes('prefers-reduced-motion: reduce') && !mode.reduced) return;
      if (media.includes('prefers-reduced-motion: no-preference') && mode.reduced) return;
      for (const match of media.matchAll(/(min|max)-width:\s*(\d+)px/g)) {
        if (match[1] === 'min' ? mode.width < Number(match[2]) : mode.width > Number(match[2])) return;
      }
    }
    rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  });
  return result;
}

// jsdom does not resolve inherited calc()/clamp(). Evaluate the numeric
// projections from the shipped stylesheet, not a second set of motion curves.
function numeric(expression: string, variables: Record<string, string>): number {
  const expanded = expression.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    if (!(name in variables)) throw new Error(`Missing phase property ${name}`);
    return String(numeric(variables[name], variables));
  });
  const tokens = expanded.match(/clamp|calc|\d*\.?\d+(?:rem|em|px|deg|%)?|[-+*/(),]/g) ?? [];
  let index = 0;
  const take = (token: string) => {
    expect(tokens[index++]).toBe(token);
  };
  const atom = (): number => {
    const token = tokens[index++];
    if (token === '-') return -atom();
    if (token === 'clamp') {
      take('(');
      const min = sum();
      take(',');
      const value = sum();
      take(',');
      const max = sum();
      take(')');
      return Math.min(max, Math.max(min, value));
    }
    if (token === 'calc') take('(');
    if (token === '(' || token === 'calc') {
      const value = sum();
      take(')');
      return value;
    }
    const value = Number.parseFloat(token);
    expect(Number.isFinite(value)).toBe(true);
    return value;
  };
  const product = (): number => {
    let value = atom();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++];
      const right = atom();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++];
      const right = product();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  expect(index).toBe(tokens.length);
  return value;
}

function pose(selectors: string[], progress: number, mode = presentation) {
  const rules = declarations(selectors, mode);
  const variables: Record<string, string> = {
    ...declarations(['.statementCopy'], mode), ...rules, '--in': String(progress),
  };
  const resolve = (value: string) => {
    let start = value.indexOf('calc(');
    while (start !== -1) {
      let end = start + 5;
      let depth = 1;
      while (depth > 0 && end < value.length) {
        if (value[end] === '(') depth++;
        if (value[end++] === ')') depth--;
      }
      const result = numeric(value.slice(start, end), variables);
      value = value.slice(0, start) + String(result) + value.slice(end);
      start = value.indexOf('calc(');
    }
    return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) =>
      String(numeric(variables[name], variables))).replace(/\s+/g, ' ');
  };
  return {
    transform: resolve(rules.transform ?? 'none'),
    clip: resolve(rules['clip-path'] ?? 'none'),
  };
}

const hinge = ['.statementLine', '.lineFirst', '.statementHinge'];
const ink = ['.statementLine', '.lineSecond', '.statementInk'];
const lead = ['.leadWord', '.leadWord:first-child'];
const lastWord = ['.leadWord'];
const support = ['.statementLine', '.lineSecond', '.statementSupport'];
const details = ['.subStatementText', '.metricValue', '.metricLabel', '.editorialPill'];

afterEach(() => {
  cleanup();
  preferences.reduced = false;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function mount() {
  render(<About />);
  const left = screen.getByTestId('about-left-column');
  const right = screen.getByTestId('about-right-column');
  const statements = left.parentElement!;
  const position = async (seq: number) => {
    await act(async () => {
      screen.getByTestId('about-sequence-overlay').style.setProperty('--seq', seq.toFixed(3));
      window.dispatchEvent(new Event('scroll'));
    });
  };
  const value = (name: string) => Number(statements.style.getPropertyValue(`--${name}`));
  const snapshot = () => ({
    phases: ['one-in', 'one-on', 'two-in', 'two-on'].map(value),
    left: [pose(hinge, value('one-in')), pose(ink, value('one-in'))],
    right: [pose(lead, value('two-in')), pose(lastWord, value('two-in')), pose(support, value('two-in'))],
    detail: details.map(selector => pose([selector], value(selector === '.subStatementText' ? 'one-in' : 'two-in'))),
  });
  return { left, right, statements, position, value, snapshot };
}

describe('About editorial text motion', () => {
  it('forwards wheel travel from selectable portal copy without cancelling or doubling native input', () => {
    const { left } = mount();
    const scrollport = document.createElement('div');
    scrollport.scrollBy = vi.fn();
    Object.defineProperty(scrollport, 'clientHeight', { value: 720 });
    const find = vi.spyOn(scrollContainer, 'findScrollContainer').mockReturnValue(scrollport);
    const copy = within(left).getByText('START WITH');
    const event = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
    fireEvent(copy, event);
    expect(scrollport.scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 80, behavior: 'auto' });
    expect(event.defaultPrevented).toBe(false);
    fireEvent.wheel(copy, { deltaY: 2, deltaMode: 1 });
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: 32, behavior: 'auto' });
    fireEvent.wheel(copy, { deltaY: -1, deltaMode: 2 });
    expect(scrollport.scrollBy).toHaveBeenLastCalledWith({ top: -720, behavior: 'auto' });
    vi.spyOn(scrollport, 'contains').mockReturnValue(true);
    fireEvent.wheel(copy, { deltaY: 100 });
    expect(scrollport.scrollBy).toHaveBeenCalledTimes(3);
    find.mockReturnValue(null);
    const nativeWindowScroll = vi.spyOn(window, 'scrollBy');
    fireEvent.wheel(copy, { deltaY: 100 });
    expect(nativeWindowScroll).not.toHaveBeenCalled();
  });

  it('keeps one native copy, factual metrics, and direct square/copy column children', () => {
    const { left, right } = mount();
    const leftHeading = within(left).getByRole('heading', { level: 3 });
    const rightHeading = within(right).getByRole('heading', { level: 3 });
    // Round 8 (D-BRAND-001): owner-specific choices, each named by the work that shows it.
    expect(leftHeading).toHaveAccessibleName('START WITH WHO USES IT');
    expect(rightHeading).toHaveAccessibleName('FROM MODEL TO INTERFACE');
    expect(within(left).getByText('START WITH')).toHaveClass(styles.statementHinge);
    expect(within(left).getByText('WHO USES IT')).toHaveClass(styles.statementInk);
    for (const work of ['Amharic IR Improved', 'EthioDriveMaster', 'Mizan']) {
      expect(projectsData.some(project => project.title === work)).toBe(true);
    }
    expect(within(left).getByText('AMHARIC SEARCH, DRIVING-TEST PRACTICE, A LEDGER FOR EVERYDAY LENDING')).toBeInTheDocument();
    expect([...rightHeading.querySelectorAll(`.${styles.leadWord}`)].map(word => word.textContent))
      .toEqual(['FROM', 'MODEL']);
    expect(within(right).getByText('TO INTERFACE')).toHaveClass(styles.statementSupport);
    expect([...right.querySelectorAll(`.${styles.metricValue}`)].map(value => value.textContent))
      .toEqual([
        String(projectsData.length),
        String(cvData.skills.reduce((total, category) => total + category.items.length, 0)),
        '3.92',
      ]);
    expect(cvData.education[0].details).toContain('GPA: 3.92 / 4.00');
    expect(within(right).getByText('GPA, BSc in Computer Science (HiLCoE, 2025)')).toBeInTheDocument();
    expect(within(right).getByText('Projects to Explore Across Web, Mobile, AI & Graphics')).toBeInTheDocument();
    expect(within(right).getByText(`Skills Across ${cvData.skills.length} Engineering & Design Categories`)).toBeInTheDocument();
    for (const column of [left, right]) {
      expect(column.children[0]).toHaveAttribute('data-statement-morph');
      expect(column.children[1]).toHaveAttribute('data-statement-copy');
      const copy = column.children[1];
      expect(copy.querySelector('[aria-hidden], [aria-label], canvas, svg')).toBeNull();
      expect(copy.querySelector(`.${styles.lineOverflowWrapper}`)).toBeNull();
      expect(copy.querySelectorAll('h3')).toHaveLength(1);
    }
  });

  it('gives the thesis, ink, edge-led words and metadata distinct phase trajectories', () => {
    const variables: Record<string, string> = { ...declarations(['.statementCopy']), '--in': '0.5' };
    const progress = (name: string) => numeric(variables[name], variables);
    expect(progress('--headline-in')).toBeGreaterThan(progress('--ink-in'));
    expect(progress('--support-in')).toBeGreaterThan(progress('--detail-in'));
    expect(progress('--detail-in')).toBeGreaterThan(progress('--tag-in'));
    expect(pose(hinge, 0.5).transform).toContain('rotateX(-');
    expect(pose(ink, 0.5).transform).toBe('none');
    expect(pose(ink, 0.5).clip).toMatch(/^inset\(-0\.18em [1-9]/);
    expect(pose(lastWord, 0.5).clip).toMatch(/^inset\(-0\.18em 0 -0\.18em [1-9]/);
    const wordProgress = (selectors: string[]) => {
      const properties: Record<string, string> = { ...declarations(selectors), '--in': '0.5' };
      return numeric(properties['--word-in'], properties);
    };
    expect(wordProgress(lastWord)).toBeGreaterThan(wordProgress(lead));
    expect(pose(support, 0.5).clip).toMatch(/^inset\([1-9]/);
    expect(pose(['.metricValue'], 0.5).transform).toMatch(/^translate3d\(0, 0\.\d*[1-9]\d*, 0\)$/);
    expect(pose(['.metricLabel'], 0.5).transform).toMatch(/^translate3d\(0\.\d*[1-9]\d*, 0, 0\)$/);
    expect(pose(['.editorialPill'], 0.5).transform).toMatch(/^translate3d\(-/);
  });

  it('fully resolves all masks and displacements within the existing beat endpoints', async () => {
    expect([STATEMENT_ARRIVE.durationMs, STATEMENT_SWAP.durationMs, STATEMENT_CLEAR.durationMs])
      .toEqual([900, 800, 600]);
    const chapter = mount();
    await chapter.position(0.3);
    expect(chapter.value('one-in')).toBe(1);
    expect(pose(hinge, chapter.value('one-in'))).toEqual({
      transform: 'perspective(700px) translate3d(0, 0, 0) rotateX(0)', clip: 'none',
    });
    expect(pose(ink, chapter.value('one-in'))).toEqual({
      transform: 'none', clip: 'inset(-0.18em 0 -0.18em 0)',
    });
    expect(pose(['.subStatementBar'], 1).transform).toBe('scaleX(1)');
    await chapter.position(0.6);
    expect(chapter.value('two-in')).toBe(1);
    for (const selectors of [lead, lastWord]) {
      expect(pose(selectors, chapter.value('two-in'))).toEqual({
        transform: 'translate3d(0, 0, 0)', clip: 'inset(-0.18em 0 -0.18em 0)',
      });
    }
    expect(pose(support, 1)).toEqual({
      transform: 'translate3d(0, 0, 0)', clip: 'inset(0 -0.08em -0.18em -0.08em)',
    });
    for (const selector of details) {
      expect(pose([selector], 1)).toEqual({ transform: 'translate3d(0, 0, 0)', clip: 'none' });
    }
    await chapter.position(0.78);
    expect(chapter.value('one-on')).toBe(0);
    expect(chapter.value('two-on')).toBe(0);
    expect(document.getElementById('about')).toHaveAttribute('data-statements-cleared', 'true');
    expect(chapter.statements).not.toHaveAttribute('data-morphing');
  });

  it('reverses the exact poses without an empty handover or idle writes', async () => {
    const chapter = mount();
    const positions = [0, 0.14, 0.3, 0.4, 0.42, 0.44, 0.6, 0.74, 0.78];
    const forward = [];
    for (const position of positions) {
      await chapter.position(position);
      forward.push(chapter.snapshot());
      if (position === 0.42) {
        expect(chapter.value('one-on') + chapter.value('two-on')).toBe(1);
        expect(chapter.value('one-on')).toBeGreaterThan(0);
        expect(chapter.value('two-on')).toBeGreaterThan(0);
        expect(pose(ink, chapter.value('one-in')).clip).not.toContain(' 100 ');
        expect(pose(lastWord, chapter.value('two-in')).clip).not.toContain(' 100)');
      }
    }
    for (let index = positions.length - 1; index >= 0; index--) {
      await chapter.position(positions[index]);
      expect(chapter.snapshot()).toEqual(forward[index]);
    }
    await chapter.position(0.6);
    const writes = vi.spyOn(chapter.statements.style, 'setProperty');
    await act(async () => {
      for (let frame = 0; frame < 30; frame++) window.dispatchEvent(new Event('scroll'));
    });
    expect(writes).not.toHaveBeenCalled();
  });

  it('makes only the readable desktop statement selectable, including on return', async () => {
    const chapter = mount();
    expect(declarations(['.statementCopy'])['pointer-events']).toBe('var(--copy-events)');
    expect(declarations(['.statementCopy'])['user-select']).toBe('text');
    expect(declarations(['.layerOne'])['--copy-events']).toBe('var(--one-copy-events, none)');
    expect(declarations(['.layerTwo'])['--copy-events']).toBe('var(--two-copy-events, none)');
    for (const [position, one, two] of [
      [0, 'none', 'none'], [0.3, 'auto', 'none'], [0.42, 'none', 'none'],
      [0.6, 'none', 'auto'], [0.74, 'none', 'none'], [0.78, 'none', 'none'],
      [0.6, 'none', 'auto'], [0.3, 'auto', 'none'], [0, 'none', 'none'],
    ] as const) {
      await chapter.position(position);
      expect(chapter.statements.style.getPropertyValue('--one-copy-events')).toBe(one);
      expect(chapter.statements.style.getPropertyValue('--two-copy-events')).toBe(two);
    }
  });

  it('keeps reduced-motion copy unmasked and excludes these refinements from phones', async () => {
    preferences.reduced = true;
    vi.stubEnv('NODE_ENV', 'development');
    const chapter = mount();
    const reduced = { width: 1440, reduced: true };
    expect(declarations(['.statementMorph'], reduced).display).toBe('none');
    expect(declarations(['.statementCopy'], reduced)['clip-path']).toBe('none');
    expect(declarations(['.statementCopy'], reduced)['--headline-in']).toBeUndefined();
    for (const selectors of [hinge, ink, lead, lastWord, support, ...details.map(selector => [selector])]) {
      expect(pose(selectors, 0.4, reduced)).toEqual({ transform: 'none', clip: 'none' });
    }
    expect(declarations(['.leadWord'], reduced).display).toBeUndefined();
    expect(declarations(['.statementCopy'], { width: 900, reduced: false })['--headline-in']).toBeUndefined();
    expect(declarations(['.leadWord'], { width: 900, reduced: false }).transform).toBeUndefined();
    await chapter.position(0.3);
    expect(chapter.value('one-on')).toBe(1);
    await chapter.position(0.6);
    expect(chapter.value('two-on')).toBe(1);
    await chapter.position(0.3);
    expect(chapter.value('one-on')).toBe(1);
  });

  it('never transitions the phase-owned properties or retains text promotion at rest', () => {
    const selectors = [...hinge, ...ink, ...lead, ...support, ...details, '.statementCopy', '.subStatementBar'];
    for (const selector of selectors) {
      const rules = declarations([selector]);
      expect(rules.animation).toBeUndefined();
      expect(rules['will-change']).toBeUndefined();
      expect(rules.transition ?? '').not.toMatch(/\b(all|transform|opacity|clip-path|filter)\b/);
    }
    for (const selector of ['.statementHinge', '.statementInk', '.leadWord', '.statementSupport']) {
      expect(declarations([`.statements[data-morphing='true'] ${selector}`])['will-change']).toBeTruthy();
    }
  });
});
