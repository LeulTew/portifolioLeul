import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Home } from './Home';

// Mock framer-motion useScroll & useTransform
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useScroll: () => ({
      scrollY: { get: () => 0 },
    }),
    useTransform: () => 0,
  };
});

describe('Home Section', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders name, titles, and bio text', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('ARCHITECTING')).toBeInTheDocument();
    expect(screen.getByText(/Full-Stack Developer/i)).toBeInTheDocument();
  });

  it('renders magnetic CTA buttons and handles navigation callbacks', () => {
    const onNavigate = vi.fn();
    render(<Home onNavigate={onNavigate} />);

    const exploreBtn = screen.getByRole('button', { name: /explore my work/i });
    const contactBtn = screen.getByRole('button', { name: /get in touch/i });

    expect(exploreBtn).toBeInTheDocument();
    expect(contactBtn).toBeInTheDocument();

    fireEvent.click(exploreBtn);
    expect(onNavigate).toHaveBeenCalledWith('about');

    fireEvent.click(contactBtn);
    expect(onNavigate).toHaveBeenCalledWith('contact');
  });

  it('handles scroll arrow click and keyboard activation', () => {
    const onNavigate = vi.fn();
    render(<Home onNavigate={onNavigate} />);

    const scrollArrow = screen.getByRole('button', { name: /scroll to about section/i });
    expect(scrollArrow).toBeInTheDocument();

    fireEvent.click(scrollArrow);
    expect(onNavigate).toHaveBeenCalledWith('about');

    fireEvent.keyDown(scrollArrow, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(scrollArrow, { key: ' ' });
    expect(onNavigate).toHaveBeenCalledTimes(3);
  });

  it('falls back to scrollIntoView when onNavigate is not provided', () => {
    const scrollIntoViewMock = vi.fn();
    const mockEl = document.createElement('div');
    mockEl.id = 'about';
    mockEl.scrollIntoView = scrollIntoViewMock;
    document.body.appendChild(mockEl);

    render(<Home />);

    const scrollArrow = screen.getByRole('button', { name: /scroll to about section/i });
    fireEvent.click(scrollArrow);
    expect(scrollIntoViewMock).toHaveBeenCalled();

    document.body.removeChild(mockEl);
  });
});
