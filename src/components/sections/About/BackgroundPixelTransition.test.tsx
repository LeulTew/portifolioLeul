import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { ThemeContext } from '../theme/ThemeContext';
import * as animationGateway from '@/lib/gateways/animationGateway';
import { ABOUT_CHAPTER_BG } from './chapterBackground';

/** What `BackgroundScene` clears background, fog and ground to in dark mode. */
const DARK_SCENE_CLEAR_COLOUR = '#001a1a';

/** WCAG relative luminance of a `#rrggbb` string. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => {
    const srgb = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

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

  it('rises to a colour the dark scene is not already painted', () => {
    /*
     * The bug this pins: dark mode used to transition to #001a1a, and #001a1a
     * is exactly what `BackgroundScene` clears the scene to in dark -- the
     * pixels climbed the whole screen to arrive at the colour behind them.
     *
     * Asserting the difference rather than the hex, because the hex is a taste
     * call and "must not match the scene" is the requirement.
     */
    render(<BackgroundPixelTransition start={0.78} end={1.0} />);
    const container = screen.getByTestId('bg-pixel-transition');
    const resolved = container.style.getPropertyValue('--bg-transition-color');

    expect(resolved).toBe(ABOUT_CHAPTER_BG.dark);
    expect(resolved).not.toBe(DARK_SCENE_CLEAR_COLOUR);
    expect(relativeLuminance(resolved)).toBeGreaterThan(
      relativeLuminance(DARK_SCENE_CLEAR_COLOUR) * 3
    );
  });

  it('transitions to emerald green in light mode', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {} }}>
        <BackgroundPixelTransition start={0.78} end={1.0} />
      </ThemeContext.Provider>
    );
    const container = screen.getByTestId('bg-pixel-transition');
    expect(container.style.getPropertyValue('--bg-transition-color')).toBe(
      ABOUT_CHAPTER_BG.light
    );
  });

  it('carries white text at or above the WCAG body-text ratio in both themes', () => {
    // The held header is painted pure white over this colour while the pixels
    // rise, so the chapter colour is a text background, not just decoration.
    for (const colour of [ABOUT_CHAPTER_BG.dark, ABOUT_CHAPTER_BG.light]) {
      const contrast = 1.05 / (relativeLuminance(colour) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
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
