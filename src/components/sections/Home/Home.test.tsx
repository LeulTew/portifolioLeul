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

  it('puts every layer on its own beat from the cue list', () => {
    const { container } = render(<Home />);
    const layers = [...container.querySelectorAll('[data-cue-layer]')].map((el) => ({
      id: (el as HTMLElement).dataset.cueLayer,
      at: (el as HTMLElement).style.getPropertyValue('--cue-at'),
    }));

    expect(layers.map((l) => l.id)).toEqual([
      'backdrop',
      'portrait',
      'title',
      'role',
      'description',
      'actions',
    ]);

    // Delays come from the sequence, never hard-coded in the markup.
    expect(layers.find((l) => l.id === 'role')?.at).toBe('2.1s');
    expect(layers.find((l) => l.id === 'actions')?.at).toBe('2.8s');
  });

  it('never hides a layer behind a JS-driven start state', () => {
    // The reason the entrance is CSS: an inline opacity:0 waiting on a tween
    // is what left the hero invisible in a tab that was never served frames.
    const { container } = render(<Home />);
    enterHero();

    for (const el of container.querySelectorAll('[data-cue-layer]')) {
      const style = (el as HTMLElement).style;
      expect(style.opacity).toBe('');
      expect(style.clipPath).toBe('');
    }
  });

  it('leaves the cue untraced while the hero holds the screen', () => {
    const { getByTestId } = render(<Home />);
    enterHero();
    expect(getByTestId('scroll-cue')).toHaveAttribute('data-progress', '0.000');
  });

  it('traces the cue as the reader scrolls toward about', () => {
    const { getByTestId } = render(<Home />);
    enterHero();

    act(() => {
      notify?.([
        {
          isIntersecting: true,
          intersectionRect: { height: 200 },
          rootBounds: { height: 1000 },
        },
      ]);
    });

    const progress = Number(getByTestId('scroll-cue').dataset.progress);
    expect(progress).toBeGreaterThan(0);
  });

  it('fills the title rather than sliding it in', () => {
    const { getAllByTestId, getByTestId } = render(<Home />);
    expect(getAllByTestId('liquid-fill-text')[0]).toHaveAttribute(
      'data-filling',
      'false'
    );

    enterHero();
    expect(getAllByTestId('liquid-fill-text')[0]).toHaveAttribute(
      'data-filling',
      'true'
    );
    expect(getByTestId('scroll-cue')).toBeInTheDocument();
  });

  it('scrolls to about when the cue is activated', () => {
    const onNavigate = vi.fn();
    const { getByTestId } = render(<Home onNavigate={onNavigate} />);

    fireEvent.click(getByTestId('scroll-cue'));
    expect(onNavigate).toHaveBeenCalledWith('about');

    fireEvent.keyDown(getByTestId('scroll-cue'), { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledTimes(2);
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

  it('settles the hero visible even if it never enters', () => {
    // The entry is triggered by IntersectionObserver, whose callbacks come with
    // the rendering lifecycle: a tab served no frames never gets one, so the
    // settle must not be gated on having entered. Observed on a pane serving
    // no frames, where the hero stayed blank indefinitely.
    vi.useFakeTimers();
    const { container } = render(<Home />);

    const content = container.querySelector('section > div') as HTMLElement;
    expect(content.className).not.toMatch(/settled/);

    // Never entered: no observer callback is delivered at all.
    act(() => vi.advanceTimersByTime(8000));
    expect(content.className).toMatch(/settled/);
  });
});
