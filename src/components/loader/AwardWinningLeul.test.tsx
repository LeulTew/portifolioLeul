import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AwardWinningLeul } from './AwardWinningLeul';

describe('AwardWinningLeul', () => {
  it('renders liquid-filling LEUL SVG with accessibility labels in dark mode', () => {
    render(<AwardWinningLeul progress={45} theme="dark" />);

    const svgElement = screen.getByRole('img', { name: /Leul/i });
    expect(svgElement).toBeInTheDocument();
    expect(screen.getAllByText(/LEUL/i).length).toBeGreaterThan(0);
  });

  it('renders liquid-filling LEUL SVG with light mode theme styles', () => {
    const { container } = render(<AwardWinningLeul progress={80} theme="light" />);

    const card = container.querySelector('[class*="standbyCardLight"]');
    expect(card).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Leul/i })).toBeInTheDocument();
  });
});
