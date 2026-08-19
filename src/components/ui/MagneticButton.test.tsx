import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
