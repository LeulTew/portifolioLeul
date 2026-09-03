import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Home } from './Home';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetHeroCue } from '@/lib/motion/heroCue';
import { HERO_SCREENS, HOLD_CLOSE_END } from '@/lib/motion/heroPin';

/**
 * Scrolls the reader `share` of the way into the hero hold.
 *
 * The hold is measured from the section own top edge and advanced from the
 * scroll store, which is published once a frame from inside the Canvas. That
 * is what a pin reads, instead of moving the page.
 */
let holdTicks = 0;
const scrollIntoHold = (share: number) => {
  const section = document.getElementById('home');
  if (!section) throw new Error('the hero section is not in the document');

  const holdLength = window.innerHeight * (HERO_SCREENS - 1);
  const top = -share * holdLength;

  vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + window.innerHeight * HERO_SCREENS,
    left: 0,
    right: window.innerWidth,
    width: window.innerWidth,
    height: window.innerHeight * HERO_SCREENS,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);

  act(() => {
    holdTicks += 1;
    setScrollProgress((holdTicks % 90) / 100);
  });
};

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

  /*
   * Every live observer, not just the most recent one.
   *
   * The hero observes its own coverage twice: once for the exit transform it
   * writes to the element, and once from the scroll cue, which is the one
   * thing on the section that genuinely re-renders per step. Keeping only the
   * last-constructed callback silently delivered scroll to one of them.
   */
  let observers: Array<(entries: unknown[]) => void> = [];
  const notify = (entries: unknown[]) => {
    observers.forEach((observer) => observer(entries));
  };

  class FakeIntersectionObserver {
    constructor(callback: (entries: unknown[]) => void) {
      observers.push(callback);
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
      notify([
        {
          isIntersecting: true,
          intersectionRect: { height: 1000 },
          rootBounds: { height: 1000 },
        },
      ]);
    });

  beforeEach(() => {
    observers = [];
    resetScrollProgress();
    resetHeroCue();
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

  it('draws the cue across the boundary, not inside the hold', () => {
    /*
     * Reported three times. The cue was traced across a hero that was still
     * leaving; then carried off the top of the window; then drawn in full
     * while it was still below the fold, so nothing happened at the seam it
     * exists to bridge. It now begins as the page comes unstuck and finishes
     * over the screen that carries it up into About.
     */
    const { getByTestId } = render(<Home />);
    enterHero();
    const drawn = () => Number(getByTestId('scroll-cue').dataset.progress);

    scrollIntoHold(HOLD_CLOSE_END * 0.5);
    expect(drawn()).toBe(0);

    // At the release: started, and no more than started.
    scrollIntoHold(1);
    const atRelease = drawn();
    expect(atRelease).toBeGreaterThan(0);
    expect(atRelease).toBeLessThan(0.35);

    // A screen past it, the line is complete and pointing into About.
    scrollIntoHold(1 + 1 / (HERO_SCREENS - 1));
    expect(drawn()).toBe(1);
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

  const exitOf = (content: HTMLElement) =>
    Number(content.style.getPropertyValue('--exit'));

  it('publishes no exit at all while the hero holds the screen', () => {
    const { container } = render(<Home />);
    enterHero();

    const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
    expect(exitOf(content)).toBe(0);
    expect(content.style.visibility).toBe('visible');
  });

  it('holds the hero still while the scroll spends itself on the handover', () => {
    /*
     * The point of the pin. The hero used to be one screen tall and simply
     * leave with the scroll, so everything it did on the way out was a side
     * effect of being carried off the top of the window. Now the scroll
     * advances the handover, and the block is pushed down by exactly as much
     * as has been scrolled -- which cancels out and reads as standing still.
     */
    const { container } = render(<Home />);
    enterHero();

    const pinned = container.querySelector('[data-testid="hero-content"]')
      ?.parentElement as HTMLElement;

    scrollIntoHold(0.5);

    const holdLength = window.innerHeight * (HERO_SCREENS - 1);
    expect(
      Number.parseFloat(pinned.style.getPropertyValue('--pin'))
    ).toBeCloseTo(holdLength * 0.5, 0);
  });

  it('stops holding once the hold is spent, and lets the page carry it away', () => {
    const { container } = render(<Home />);
    enterHero();

    const pinned = container.querySelector('[data-testid="hero-content"]')
      ?.parentElement as HTMLElement;

    scrollIntoHold(3);

    const holdLength = window.innerHeight * (HERO_SCREENS - 1);
    expect(
      Number.parseFloat(pinned.style.getPropertyValue('--pin'))
    ).toBeCloseTo(holdLength, 0);
  });

  it('finishes the exit inside the hold, not after it', () => {
    /*
     * Everything the hero does has to be done while it is still being held and
     * looked at, which is the whole reason for holding it. And there has to be
     * hold left afterwards, for the cue.
     */
    const { container } = render(<Home />);
    enterHero();

    scrollIntoHold(HOLD_CLOSE_END);

    const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
    expect(exitOf(content)).toBe(1);
    expect(content.style.visibility).toBe('hidden');
    expect(content.style.pointerEvents).toBe('none');
    // The container itself no longer animates; the layers do.
    expect(content.style.filter).toBe('');
    expect(content.style.transform).toBe('');
    expect(HOLD_CLOSE_END).toBeLessThan(1);
  });

  it('scrubs the exit rather than switching it', () => {
    // Part way through the hold is part way out: the layers stagger off a
    // continuous value, so it has to be continuous.
    const { container } = render(<Home />);
    enterHero();

    scrollIntoHold(0.2);

    const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
    expect(exitOf(content)).toBeGreaterThan(0);
    expect(exitOf(content)).toBeLessThan(0.5);
  });

  it('settles the hero visible even if it never enters', () => {
    // The entry is triggered by IntersectionObserver, whose callbacks come with
    // the rendering lifecycle: a tab served no frames never gets one, so the
    // settle must not be gated on having entered. Observed on a pane serving
    // no frames, where the hero stayed blank indefinitely.
    vi.useFakeTimers();
    const { container } = render(<Home />);

    const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
    expect(content.className).not.toMatch(/settled/);

    // Never entered: no observer callback is delivered at all.
    act(() => vi.advanceTimersByTime(8000));
    expect(content.className).toMatch(/settled/);
  });
});
