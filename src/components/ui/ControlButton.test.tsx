import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type Root } from 'postcss';
import { ControlButton } from './ControlButton';
import styles from './ControlButton.module.css';

afterEach(cleanup);

describe('ControlButton', () => {
  it('forwards native button props, children, custom class and click without a provider', async () => {
    const onClick = vi.fn();
    render(
      <ControlButton
        id="next-control"
        name="chapter"
        value="next"
        title="Continue"
        aria-controls="skill-stage"
        className="custom-control"
        style={{ width: 120 }}
        onClick={onClick}
      >
        <span>Next skill</span>
      </ControlButton>,
    );

    const button = screen.getByRole('button', { name: 'Next skill' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('id', 'next-control');
    expect(button).toHaveAttribute('name', 'chapter');
    expect(button).toHaveAttribute('value', 'next');
    expect(button).toHaveAttribute('title', 'Continue');
    expect(button).toHaveAttribute('aria-controls', 'skill-stage');
    expect(button).toHaveClass(styles.button, styles.secondary, 'custom-control');
    expect(button).toHaveStyle({ width: '120px' });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards aria-label and applies icon-only and primary variants without leaking props', () => {
    const { rerender } = render(
      <ControlButton iconOnly aria-label="Previous skill">
        <svg aria-hidden="true" />
      </ControlButton>,
    );
    const previous = screen.getByRole('button', { name: 'Previous skill' });
    expect(previous).toHaveClass(styles.iconOnly, styles.secondary);
    expect(previous).not.toHaveAttribute('iconOnly');
    expect(previous).not.toHaveAttribute('variant');

    rerender(<ControlButton variant="primary">Next skill</ControlButton>);
    expect(screen.getByRole('button', { name: 'Next skill' })).toHaveClass(styles.primary);
    expect(screen.getByRole('button')).not.toHaveClass(styles.iconOnly);
  });

  it('retains native ref, focus, keyboard activation and form button types', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    const onFocus = vi.fn();
    const onSubmit = vi.fn(event => event.preventDefault());
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <ControlButton ref={ref} onClick={onClick} onFocus={onFocus}>Next</ControlButton>
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Next' });
    expect(ref.current).toBe(button);
    ref.current?.focus();
    expect(button).toHaveFocus();
    expect(onFocus).toHaveBeenCalledOnce();
    await user.keyboard('{Enter} ');
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <form onSubmit={onSubmit}>
        <ControlButton type="submit">Continue</ControlButton>
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(ref.current).toBeNull();
  });

  it('uses native disabled semantics for click and keyboard focus', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <ControlButton disabled onClick={onClick}>Previous</ControlButton>
        <ControlButton>Next</ControlButton>
      </>,
    );
    const previous = screen.getByRole('button', { name: 'Previous' });
    expect(previous).toBeDisabled();
    previous.click();
    await user.click(previous);
    previous.focus();
    expect(previous).not.toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not cancel or capture wheel input', () => {
    const onWheel = vi.fn();
    render(
      <div onWheel={onWheel}>
        <ControlButton>Next</ControlButton>
      </div>,
    );
    const button = screen.getByRole('button', { name: 'Next' });
    expect(fireEvent.wheel(button, { deltaY: 120, cancelable: true })).toBe(true);
    expect(onWheel).toHaveBeenCalledOnce();
  });
});

const readCss = (file: string) => postcss.parse(readFileSync(join(__dirname, file), 'utf8'));
const controlCss = readCss('ControlButton.module.css');
const foundationCss = readCss('controlFoundation.module.css');
const navCss = readCss(join('..', 'Navigation.module.css'));
const magneticCss = readCss('MagneticButton.module.css');
const railCss = readCss('chamferRail.module.css');

function declarations(css: Root, selector: string): Record<string, string> {
  const rule = css.nodes.find(node => node.type === 'rule' && node.selectors.includes(selector));
  if (!rule || rule.type !== 'rule') throw new Error(`Missing CSS rule: ${selector}`);
  const result: Record<string, string> = {};
  rule.walkDecls(declaration => { result[declaration.prop] = declaration.value; });
  return result;
}

describe('shared control styling contract', () => {
  it('reuses one chamfer polygon and keeps the incumbent 10px, 9.5px and 14px cuts', () => {
    const tokens: Record<string, string> = {};
    foundationCss.walkAtRules('value', rule => {
      const separator = rule.params.indexOf(':');
      tokens[rule.params.slice(0, separator)] = rule.params.slice(separator + 1).trim();
    });
    expect(tokens).toEqual({
      brandMint: '#00ff9d',
      brandEmerald: '#059669',
      navSurfaceLight: 'rgba(255, 255, 255, 0.88)',
      navSurfaceDark: 'rgba(0, 14, 18, 0.82)',
      chamferPath: 'polygon(var(--chamfer-cut) 0%, 100% 0%, 100% calc(100% - var(--chamfer-cut)), calc(100% - var(--chamfer-cut)) 100%, 0% 100%, 0% var(--chamfer-cut))',
    });
    for (const css of [navCss, magneticCss, controlCss]) {
      const imports: string[] = [];
      css.walkAtRules('value', rule => { imports.push(rule.params); });
      expect(imports).toEqual([expect.stringMatching(/chamferPath.*brandMint.*controlFoundation\.module\.css/)]);
    }
    for (const [css, selector, cut] of [
      [navCss, '.navBar', '10px'],
      [navCss, '.navBarInner', '9.5px'],
      [magneticCss, '.cutoutFrame', '14px'],
      [controlCss, '.frame', '10px'],
      [controlCss, '.surface', '9.5px'],
    ] as const) {
      expect(declarations(css, selector)).toMatchObject({
        '--chamfer-cut': cut,
        'clip-path': 'chamferPath',
      });
    }
    expect(declarations(navCss, ":global([data-theme='light']) .navBarInner").background).toBe('navSurfaceLight');
    expect(declarations(navCss, ":global([data-theme='dark']) .navBarInner").background).toBe('navSurfaceDark');
    expect(declarations(magneticCss, '.primary').background).toBe('linear-gradient(135deg, brandMint 0%, #00d17a 100%)');
  });

  it('draws the Projects control rails in the navbar silhouette, not as pills', () => {
    // Round 17-18 design review: pill rails sat beside chamfered navigation and buttons.
    const imports: string[] = [];
    railCss.walkAtRules('value', rule => { imports.push(rule.params); });
    expect(imports).toEqual([expect.stringMatching(/chamferPath.*navSurfaceLight.*navSurfaceDark.*controlFoundation\.module\.css/)]);
    expect(declarations(railCss, '.rail::before')['clip-path']).toBe('chamferPath');
    expect(declarations(railCss, '.rail')['--rail-fill']).toBe('navSurfaceDark');
    expect(declarations(railCss, ".rail[data-tone='light']")['--rail-fill']).toBe('navSurfaceLight');
    expect(declarations(railCss, '.tab::before')['clip-path']).toBe('chamferPath');
  });

  it('provides standalone dark defaults and data-theme light surfaces using nav and hero accents', () => {
    expect(declarations(controlCss, '.button')).toMatchObject({
      '--control-surface': 'navSurfaceDark',
      '--control-focus': 'brandMint',
      '--control-color': '#f0fff8',
    });
    const lightButton = declarations(controlCss, ":global([data-theme='light']) .button");
    expect(lightButton).toMatchObject({
      '--control-surface': 'navSurfaceLight',
      '--control-focus': 'brandEmerald',
      '--control-color': '#0a251e',
    });
    expect(declarations(controlCss, ".button:global([data-theme='light'])")).toEqual(lightButton);
    for (const selector of ['.primary', ":global([data-theme='light']) .primary"]) {
      const primary = declarations(controlCss, selector);
      expect(primary['--control-color']).toBeUndefined();
      expect(primary['--control-border']).toBeUndefined();
      expect(primary['--control-surface']).toBeUndefined();
      expect(primary['--control-hover-surface']).toBeDefined();
    }
  });

  it('keeps 48px targets and an unclipped native keyboard focus outline', () => {
    const button = declarations(controlCss, '.button');
    expect(button).toMatchObject({ 'min-width': '48px', 'min-height': '48px' });
    expect(button['clip-path']).toBeUndefined();
    expect(button.overflow).toBeUndefined();
    expect(declarations(controlCss, '.iconOnly').width).toBe('48px');
    expect(declarations(controlCss, '.button:focus-visible')).toEqual({
      outline: '2px solid var(--control-focus)',
      'outline-offset': '3px',
    });
    expect(declarations(controlCss, '.button:disabled')).toEqual({
      opacity: '0.45',
      cursor: 'not-allowed',
    });
  });

  it('limits hover to enabled fine-pointer input with no animation or filter cost', () => {
    const hovers: string[] = [];
    controlCss.walkRules(rule => {
      if (!rule.selector.includes(':hover')) return;
      hovers.push(rule.selector);
      expect(rule.parent?.type).toBe('atrule');
      if (rule.parent?.type === 'atrule') {
        expect(rule.parent.params).toBe('(hover: hover) and (pointer: fine)');
      }
    });
    expect(hovers).toEqual(['.button:not(:disabled):hover']);
    controlCss.walkRules('.button:not(:disabled):hover', rule => {
      const values: Record<string, string> = {};
      rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
      expect(values).toMatchObject({
        '--control-border': 'var(--control-hover-border)',
        '--control-surface': 'var(--control-hover-surface)',
        color: 'var(--control-hover-color)',
      });
    });
    controlCss.walkDecls(declaration => {
      expect(declaration.prop).not.toMatch(/^(animation|filter|backdrop-filter|will-change)/);
    });
    const reducedMotion: string[] = [];
    controlCss.walkAtRules('media', rule => {
      if (rule.params === '(prefers-reduced-motion: reduce)') {
        rule.walkDecls('transition', declaration => { reducedMotion.push(declaration.value); });
      }
    });
    expect(reducedMotion).toEqual(['none']);
  });
});
