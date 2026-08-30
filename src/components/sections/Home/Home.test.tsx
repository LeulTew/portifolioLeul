import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Home choreography', () => {
  const originalObserver = globalThis.IntersectionObserver;
  let notify: ((entries: unknown[]) => void) | null = null;

  class FakeIntersectionObserver {
    constructor(callback: (entries: unknown[]) => void) {
      notify = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }

  const enterHero = () =>
    act(() => {
      notify?.([
        {
          isIntersecting: true,
          intersectionRect: { height: 1000 },
          rootBounds: { height: 1000 },
        },
      ]);
    });

  beforeEach(() => {
    notify = null;
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      originalObserver;
    vi.useRealTimers();
  });

  it('tags every GSAP-driven layer with its cue', () => {
    const { container } = render(<Home />);
    const cues = [...container.querySelectorAll('[data-cue]')].map(
      (el) => (el as HTMLElement).dataset.cue
    );
    expect(cues).toEqual(['title', 'role', 'description']);
  });

  it('settles the copy visible even if no animation frame ever runs', () => {
    // A tab that is never served frames would otherwise leave the hero copy
    // at the sequence's opacity-0 start state indefinitely.
    vi.useFakeTimers();
    const { container } = render(<Home />);
    enterHero();

    act(() => vi.advanceTimersByTime(5000));

    for (const el of container.querySelectorAll('[data-cue]')) {
      expect((el as HTMLElement).style.opacity).toBe('1');
    }
  });

  it('leaves the hero untransformed while it holds the screen', () => {
    const { container } = render(<Home />);
    enterHero();

    const content = container.querySelector('section > div') as HTMLElement;
    expect(content.style.opacity).toBe('1');
    expect(content.style.filter).toBe('none');
  });

  it('fades and defocuses the hero as it scrolls out of view', () => {
    const { container } = render(<Home />);
    enterHero();

    act(() => {
      notify?.([
        {
          isIntersecting: true,
          intersectionRect: { height: 40 },
          rootBounds: { height: 1000 },
        },
      ]);
    });

    const content = container.querySelector('section > div') as HTMLElement;
    expect(Number(content.style.opacity)).toBeLessThan(1);
    expect(content.style.filter).toContain('blur');
    expect(content.style.transform).toContain('translate3d');
  });

  it('never fades the hero to nothing', () => {
    const { container } = render(<Home />);
    enterHero();

    act(() => {
      notify?.([{ isIntersecting: false, intersectionRect: { height: 0 }, rootBounds: { height: 1000 } }]);
    });

    const content = container.querySelector('section > div') as HTMLElement;
    expect(Number(content.style.opacity)).toBeGreaterThan(0.1);
  });
});
