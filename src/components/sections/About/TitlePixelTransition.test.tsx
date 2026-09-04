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
    expect(dots.length).toBe(16 * 3); // 16 cols * 3 rows
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
});
