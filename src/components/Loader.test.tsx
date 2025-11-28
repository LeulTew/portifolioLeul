import { render, screen } from '@testing-library/react';
import { Loader } from './Loader';

describe('Loader', () => {
  it('renders loader with text', () => {
    render(<Loader />);

    expect(screen.getByText('Leul')).toBeInTheDocument();
  });

  it('has correct structure', () => {
    render(<Loader />);

    const loader = screen.getByText('Leul').parentElement;
    expect(loader).toBeInTheDocument();

    // Check for progress bar element
    const progressBar = loader?.querySelector('[class*="progress"]');
    expect(progressBar).toBeInTheDocument();
  });
});