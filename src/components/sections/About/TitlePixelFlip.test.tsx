import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePixelFlip } from './TitlePixelFlip';

describe('TitlePixelFlip Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial heading "About Me" and subtitle', () => {
    render(<TitlePixelFlip />);
    const heading = screen.getByRole('heading', { level: 2, name: /About Me/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId('title-pixel-flip-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('title-pixel-flip-cell').length).toBeGreaterThan(0);
  });

  it('contains expected number of grid cells for title text box', () => {
    render(<TitlePixelFlip />);
    const cells = screen.getAllByTestId('title-pixel-flip-cell');
    expect(cells.length).toBe(14 * 3); // 14 cols * 3 rows
  });

  it('swaps text to "Education" when progress reaches midpoint or beyond', () => {
    render(<TitlePixelFlip start={0.88} end={1.0} />);
    const flipContainer = screen.getByTestId('title-pixel-flip');
    
    // Simulate --seq set to 0.96 (past midpoint 0.94)
    flipContainer.style.setProperty('--seq', '0.96');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-flip-heading');
    expect(heading.textContent).toBe('Education');
  });

  it('respects custom initial and flipped text props', () => {
    render(
      <TitlePixelFlip
        initialTitle="Custom Start"
        flippedTitle="Custom End"
      />
    );
    expect(screen.getByText('Custom Start')).toBeInTheDocument();
  });
});
