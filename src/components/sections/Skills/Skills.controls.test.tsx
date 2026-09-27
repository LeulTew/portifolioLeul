import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { cancelSectionLanding, landSectionFocus } from '@/lib/scroll/sectionLanding';
import { Skills } from './Skills';
import { SKILL_CHAPTERS } from './skillsData';

const playback = vi.hoisted(() => ({
  active: 0, settledIndex: 0, phase: 'reading', ready: true, visible: true,
  step: vi.fn(), select: vi.fn(),
}));
vi.mock('./useSkillsPlayback', () => ({
  useSkillsStaged: () => true,
  useSkillsPlayback: () => playback,
}));

beforeEach(() => vi.clearAllMocks());

describe('Skills chapter controls', () => {
  it('scopes chapter chrome to the named semantic section instead of global landmarks', () => {
    render(<Skills />);
    const stage = screen.getByTestId('skills-stage');
    expect(stage.tagName).toBe('SECTION');
    expect(stage).toHaveRole('region');
    expect(stage).toHaveAccessibleName('Skills');
    for (const chrome of stage.querySelectorAll('[data-skill-chrome]')) {
      expect(chrome.closest('section')).toBe(stage);
      expect(chrome.tagName).toBe('DIV');
      expect(chrome).not.toHaveAttribute('role');
    }
    expect(stage.querySelectorAll('[data-skill-chrome]')).toHaveLength(2);
    expect(stage.querySelectorAll('header, footer')).toHaveLength(0);
    expect(stage).toContainElement(screen.getByRole('button', { name: /^Next:/ }));
    expect(stage).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('lands navbar focus on the staged heading, not the inert host left in the document', () => {
    const main = document.createElement('main');
    main.inert = true;
    document.body.append(main);
    render(<Skills />, { container: main });
    const heading = screen.getByRole('heading', { name: 'Skills' });
    expect(main).not.toContainElement(heading);
    expect(main.querySelector('#skills')).not.toHaveAttribute('data-section-landing');
    landSectionFocus('skills');
    expect(heading).toHaveFocus();
    cancelSectionLanding();
    main.remove();
  });

  it('keeps all six named selectors in the native tab order with native activation', async () => {
    const user = userEvent.setup();
    render(<Skills />);
    const selectors = within(screen.getByRole('list', { name: 'Skills chapters' })).getAllByRole('button');
    expect(selectors).toHaveLength(SKILL_CHAPTERS.length);
    // The reading chapter's own source link comes first, as content before its controls;
    // the other chapters' links are out of the order while they are hidden.
    await user.tab();
    expect(screen.getByRole('link', { name: new RegExp(SKILL_CHAPTERS[0].proof.label) })).toHaveFocus();
    for (const [index, button] of selectors.entries()) {
      expect(button).toHaveAccessibleName(`Show ${SKILL_CHAPTERS[index].title}`);
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard(index % 2 ? ' ' : '{Enter}');
      expect(playback.select).toHaveBeenLastCalledWith(index);
    }
    await user.tab();
    expect(screen.getByRole('button', { name: 'Back to About' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Next:/ })).toHaveFocus();
    expect(selectors[0]).toHaveAttribute('aria-current', 'step');
    expect(selectors.slice(1).every(button => !button.hasAttribute('aria-current'))).toBe(true);
  });

  it('separates 48px hit areas from the original thin visual indicators', () => {
    const css = postcss.parse(readFileSync(join(__dirname, 'Skills.module.css'), 'utf8'));
    const declarations = (selector: string) => {
      const values: Record<string, string> = {};
      css.walkRules(rule => {
        if (!rule.selectors.includes(selector)) return;
        rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
      });
      return values;
    };
    expect(declarations('.progress > li').flex).toBe('0 0 48px');
    expect(declarations('.progressButton')).toMatchObject({
      width: '48px', height: '48px', padding: '0', background: 'transparent',
    });
    expect(declarations('.progressButton::after')).toMatchObject({
      width: 'clamp(12px, 1.5vw, 28px)', height: '2px',
      left: '50%', transform: 'translateX(-50%)',
    });
    expect(declarations('.progressButton:focus-visible')).toEqual({
      outline: '2px solid var(--skill-accent)', 'outline-offset': '2px',
    });
  });

  it('lands a linear Skills on one screen: its first chapter reaches the window edge, never a cut heading', () => {
    // Round 37 (D-R37-002): at 3840x2160 the first chapter ended above the edge and the next
    // chapter's heading was cut by it. The floor reckons everything above the first chapter.
    const css = postcss.parse(readFileSync(join(__dirname, 'Skills.module.css'), 'utf8'));
    const app = postcss.parse(readFileSync(join(__dirname, '..', '..', '..', 'App.module.css'), 'utf8'));
    const rule = (sheet: postcss.Root, selector: string) => {
      const values: Record<string, string> = {};
      sheet.walkRules(found => {
        if (found.parent?.type !== 'root' || !found.selectors.includes(selector)) return;
        found.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
      });
      return values;
    };
    const floor = rule(css, ".stage[data-staged='false'] .chapter:first-child")['min-height'];
    for (const part of ['100svh', 'var(--section-lead', 'var(--skills-content-top)', 'var(--skills-title-size)',
      'var(--skills-header-gap)']) expect(floor).toContain(part);
    // Each named part is what the page actually lays out above the chapter.
    expect(rule(app, '.main > *')).toMatchObject({ '--section-lead': '100px', 'padding-top': 'var(--section-lead)' });
    expect(rule(css, '.content').padding).toMatch(/^var\(--skills-content-top\) /);
    expect(rule(css, '.sectionTitle')['font-size']).toBe('var(--skills-title-size)');
    expect(rule(css, '.header')['padding-bottom']).toBe('var(--skills-header-gap)');
    // A floor, never a cap: a taller chapter keeps its height.
    expect(rule(css, ".stage[data-staged='false'] .chapter:first-child")['max-height']).toBeUndefined();
    // Round 38 (D-R38-001): the content stays under the header; the added room closes the chapter.
    expect(rule(css, ".stage[data-staged='false'] .chapter:first-child")['align-content']).toBe('start');
    // Every media query that moves the content's top moves the named value, not the padding.
    css.walkAtRules('media', media => media.walkRules('.content', found => {
      found.walkDecls('padding-top', () => { throw new Error(`${media.params} sets .content padding-top directly`); });
    }));
  });
});
