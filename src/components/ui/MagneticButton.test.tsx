import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { MagneticButton } from './MagneticButton';
import * as animGateway from '@/lib/gateways/animationGateway';

describe('MagneticButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders button element with default primary variant', () => {
    render(<MagneticButton>Click Me</MagneticButton>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeDefined();
  });

  it('renders anchor link when href is provided', () => {
    render(
      <MagneticButton href="https://example.com" target="_blank">
        External Link
      </MagneticButton>
    );
    const link = screen.getByRole('link', { name: /external link/i });
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each(['light', 'dark'])('keeps native tab/activation and explicit focus-theme semantics in %s', async theme => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<>
      <MagneticButton theme={theme} onClick={onClick}>Explore My Work</MagneticButton>
      <MagneticButton theme={theme} variant="secondary" icon={false}>Get In Touch</MagneticButton>
      <MagneticButton theme={theme} href="#work">Project link</MagneticButton>
    </>);
    const primary = screen.getByRole('button', { name: 'Explore My Work' });
    const secondary = screen.getByRole('button', { name: 'Get In Touch' });
    const link = screen.getByRole('link', { name: 'Project link' });
    await user.tab();
    expect(primary).toHaveFocus();
    await user.keyboard('{Enter} ');
    expect(onClick).toHaveBeenCalledTimes(2);
    await user.tab();
    expect(secondary).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    for (const control of [primary, secondary, link]) {
      expect(control).toHaveAttribute('data-theme', theme);
      expect(control.tabIndex).toBe(0);
    }
  });

  it('paints focus on the unclipped 48px wrapper using the existing control tokens', () => {
    const css = postcss.parse(readFileSync(join(__dirname, 'MagneticButton.module.css'), 'utf8'));
    const declarations = (selector: string) => {
      const values: Record<string, string> = {};
      css.walkRules(rule => {
        if (!rule.selectors.includes(selector)) return;
        rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
      });
      return values;
    };
    const wrapper = declarations('.magneticWrapper');
    expect(wrapper).toMatchObject({
      'min-width': '48px', 'min-height': '48px', '--control-focus': 'brandMint',
    });
    expect(wrapper['clip-path']).toBeUndefined();
    expect(wrapper.overflow).toBeUndefined();
    expect(wrapper.outline).toBeUndefined();
    expect(declarations('.magneticWrapper:focus-visible')).toEqual({
      outline: '2px solid var(--control-focus)', 'outline-offset': '3px',
    });
    expect(declarations(".magneticWrapper:global([data-theme='light'])")['--control-focus']).toBe('brandEmerald');
    expect(declarations(':global([data-theme=\'light\']) .magneticWrapper')['--control-focus']).toBe('brandEmerald');
    expect(declarations('.cutoutFrame')['clip-path']).toBe('chamferPath');
  });

  it('calculates magnetic spring offset on mouseMove and resets on mouseLeave', () => {
    render(<MagneticButton>Magnetic Action</MagneticButton>);
    const btn = screen.getByRole('button', { name: /magnetic action/i });

    // Mock getBoundingClientRect
    vi.spyOn(btn, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 50,
      right: 300,
      bottom: 150,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // Move cursor offset from center (200, 125)
    fireEvent.mouseMove(btn, { clientX: 250, clientY: 150 });
    // Leave button
    fireEvent.mouseLeave(btn);
  });

  it('bypasses magnetic movement when prefers-reduced-motion is true', () => {
    vi.spyOn(animGateway, 'getPrefersReducedMotion').mockReturnValue(true);
    render(<MagneticButton>Static Button</MagneticButton>);
    const btn = screen.getByRole('button', { name: /static button/i });

    const getBoundingSpy = vi.spyOn(btn, 'getBoundingClientRect');
    fireEvent.mouseMove(btn, { clientX: 250, clientY: 150 });
    expect(getBoundingSpy).not.toHaveBeenCalled();
  });

  it('supports secondary and glass variants in light and dark mode', () => {
    const { rerender } = render(
      <MagneticButton variant="secondary" theme="light">
        Secondary Light
      </MagneticButton>
    );
    expect(screen.getByText(/secondary light/i)).toBeDefined();

    rerender(
      <MagneticButton variant="glass" theme="dark">
        Glass Dark
      </MagneticButton>
    );
    expect(screen.getByText(/glass dark/i)).toBeDefined();
  });

  it('pauses tracer motion only under an inert or chapter-covered background', () => {
    const selectors: string[] = [];
    postcss.parse(readFileSync(join(__dirname, 'MagneticButton.module.css'), 'utf8'))
      .walkRules(rule => {
        rule.walkDecls('animation-play-state', declaration => {
          if (declaration.value === 'paused') selectors.push(...rule.selectors);
        });
      });
    expect(selectors).toEqual([
      ':global(main[inert]) .tracerBeam',
      ':global([data-education-covered]) .tracerBeam',
      ':global([data-skills-covered]) .tracerBeam',
    ]);
  });
});
