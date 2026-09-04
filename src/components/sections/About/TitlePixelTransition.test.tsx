import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePixelTransition } from './TitlePixelTransition';

describe('TitlePixelTransition Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial heading "About Me" and subtitle', () => {
    render(<TitlePixelTransition />);
    const heading = screen.getByRole('heading', { level: 2, name: /About Me/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId('title-pixel-transition-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('title-pixel-transition-dot').length).toBeGreaterThan(0);
  });

  it('contains expected number of pixel dots for title text box', () => {
    render(<TitlePixelTransition />);
    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    expect(dots.length).toBe(20 * 4); // 20 cols * 4 rows
  });

  it('progressively writes and reveals "Education" when progress advances', () => {
    render(<TitlePixelTransition start={0.88} end={1.0} />);
    const container = screen.getByTestId('title-pixel-transition');

    // Simulate progress past midpoint (e.g. 0.98)
    container.style.setProperty('--seq', '0.99');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toBe('Education');
  });

  it('respects custom initial and flipped text props', () => {
    render(
      <TitlePixelTransition
        initialTitle="Custom Start"
        flippedTitle="Custom End"
      />
    );
    expect(screen.getByText('Custom Start')).toBeInTheDocument();
  });

  it('Phase 1: white pixel dots activate and cover/dissolve About Me', () => {
    render(<TitlePixelTransition start={0.88} end={1.0} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 0.91 is p ~ 0.25 (Phase 1)
    container.style.setProperty('--seq', '0.91');
    window.dispatchEvent(new Event('resize'));

    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    const activeDots = dots.filter((d) => d.getAttribute('data-active') === 'true');
    expect(activeDots.length).toBeGreaterThan(0);
  });

  it('Phase 2: Education begins emerging within active pixel field', () => {
    render(<TitlePixelTransition start={0.88} end={1.0} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 0.95 is p ~ 0.58 (Phase 2 writing phase)
    container.style.setProperty('--seq', '0.95');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toMatch(/^Edu/);
  });

  it('Phase 3: pixel dots clear away leaving clean Education title', () => {
    render(<TitlePixelTransition start={0.88} end={1.0} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 1.0 (Phase 3 complete)
    container.style.setProperty('--seq', '1.0');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toBe('Education');

    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    const activeDots = dots.filter((d) => d.getAttribute('data-active') === 'true');
    expect(activeDots.length).toBe(0);
  });
});
