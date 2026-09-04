import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { ThemeContext } from '../theme/ThemeContext';
import * as animationGateway from '@/lib/gateways/animationGateway';

describe('BackgroundPixelTransition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders grid, cells, and backdrop strictly in the background', () => {
    render(<BackgroundPixelTransition start={0.78} end={1.0} />);

    const container = screen.getByTestId('bg-pixel-transition');
    expect(container).toBeInTheDocument();
    expect(container.getAttribute('aria-hidden')).toBe('true');

    const backdrop = screen.getByTestId('bg-pixel-transition-backdrop');
    expect(backdrop).toBeInTheDocument();

    const grid = screen.getByTestId('bg-pixel-transition-grid');
    expect(grid).toBeInTheDocument();

    const cells = screen.getAllByTestId('bg-pixel-transition-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('defaults to dark greenish (#001a1a) in dark mode', () => {
    render(<BackgroundPixelTransition start={0.78} end={1.0} />);
    const container = screen.getByTestId('bg-pixel-transition');
    expect(container.style.getPropertyValue('--bg-transition-color')).toBe('#001a1a');
  });

  it('transitions to whitish (#f4f7ff) in light mode', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
        <BackgroundPixelTransition start={0.78} end={1.0} />
      </ThemeContext.Provider>
    );
    const container = screen.getByTestId('bg-pixel-transition');
    expect(container.style.getPropertyValue('--bg-transition-color')).toBe('#f4f7ff');
  });

  it('supports reduced motion mode cleanly', () => {
    vi.spyOn(animationGateway, 'getPrefersReducedMotion').mockReturnValue(true);

    render(<BackgroundPixelTransition start={0.78} end={1.0} />);
    const container = screen.getByTestId('bg-pixel-transition');
    expect(container).toBeInTheDocument();
  });

  it('activates data-bg-transition on #about when progress climbs and cleans up', () => {
    const aboutEl = document.createElement('section');
    aboutEl.id = 'about';
    document.body.appendChild(aboutEl);

    const { unmount } = render(<BackgroundPixelTransition start={0.78} end={1.0} />);
    const container = screen.getByTestId('bg-pixel-transition');

    // Simulate progress past 0.85
    container.style.setProperty('--seq', '0.97');
    window.dispatchEvent(new Event('scroll'));

    unmount();
    expect(aboutEl.getAttribute('data-bg-transition')).toBeNull();
    aboutEl.remove();
  });
});
