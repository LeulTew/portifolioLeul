import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Home } from './Home';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetHeroCue } from '@/lib/motion/heroCue';
import { HERO_SCREENS, HOLD_CLOSE_END, INNER_END } from '@/lib/motion/heroPin';

/**
 * Scrolls the reader `share` of the way into the hero hold.
 *
 * The hold is measured from the section own top edge and advanced from the
 * scroll store, which is published once a frame from inside the Canvas. That
 * is what a pin reads, instead of moving the page.
 */
let holdTicks = 0;
const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', async (importOriginal) => ({
  // Only the preference is faked; the rest of the gateway -- Springs, Easings,
  // the scroll helpers -- is used for real by the tree under test.
  ...(await importOriginal<typeof import('@/lib/gateways/animationGateway')>()),
  getPrefersReducedMotion: () => reducedMotion(),
}));

/**
 * jsdom has no layout, so the cue's rail measures zero and the mark stays
 * undrawn. These are the numbers `measure()` reads -- where the plate ends,
 * where About begins, and where About's heading is pinned -- supplied directly
 * so the drawing can be exercised.
 */
const layOutRail = ({
  plateBottom = 700,
  aboutTop = 2350,
  headingTop = 160,
} = {}) => {
  const section = document.getElementById('home');
  if (!section) throw new Error('the hero section is not in the document');

  document.getElementById('about')?.remove();
  const about = document.createElement('div');
  about.id = 'about';
  const heading = document.createElement('div');
  heading.setAttribute('data-testid', 'about-held-header');
  about.appendChild(heading);
  document.body.appendChild(about);

  const rect = (el: Element, box: { top: number; bottom: number }) => {
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ ...box, left: 0, right: 0, width: 0, height: box.bottom - box.top, x: 0, y: box.top, toJSON: () => ({}) }),
    });
  };

  Object.defineProperty(section, 'offsetTop', { configurable: true, value: 0 });
  Object.defineProperty(about, 'offsetTop', { configurable: true, value: aboutTop });
  // The rail reads the heading's resolved `top`, not its rect: inline style is
  // the only thing jsdom will resolve for it.
  heading.style.position = 'absolute';
  heading.style.top = `${headingTop}px`;

  // The plate is measured against the pinned block, so both need a box.
  const plate = section.querySelector('[data-cue-layer="backdrop"]');
  const pinned = section.querySelector('[class*="pinned"]');
  if (pinned) rect(pinned, { top: 0, bottom: window.innerHeight });
  if (plate) rect(plate, { top: plateBottom - 400, bottom: plateBottom });

  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

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
    reducedMotion.mockReturnValue(false);
    // The rail stub is a real node on the body; testing-library does not own it.
    document.getElementById('about')?.remove();
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
    layOutRail();
    expect(getByTestId('scroll-cue')).toHaveAttribute('data-progress', '0.000');
  });

  it('draws nothing at all until the rail has been measured', () => {
    // About's offset is a measurement, and it is zero before the first one
    // lands. That has to read as "not known yet", not as a finished line.
    const { getByTestId } = render(<Home />);
    enterHero();
    scrollIntoHold(1);

    expect(getByTestId('scroll-cue')).toHaveAttribute('data-progress', '0.000');
  });

  it('runs the cue from under the plate all the way down to About', () => {
    /*
     * Reported four times. Traced across a hero that was still leaving; then
     * carried off the top of the window; then drawn in full below the fold
     * where nobody saw it; then held, which caps it at the height of the
     * window. It is a rail down the page now: as long as the gap it spans,
     * begun under the plate, and drawn alongside the plate shutting.
     */
    const { getByTestId } = render(<Home />);
    enterHero();
    const plateBottom = 700;
    const aboutTop = 2350;
    layOutRail({ plateBottom, aboutTop });

    const cue = () => getByTestId('scroll-cue');
    const drawn = () => Number(cue().dataset.progress);
    const section = document.getElementById('home')!;
    const vh = window.innerHeight;
    const hold = vh * (HERO_SCREENS - 1);

    const top = Number.parseFloat(section.style.getPropertyValue('--cue-top'));
    const height = Number.parseFloat(section.style.getPropertyValue('--cue-height'));

    // Long: more than a window's worth, which is more than any pin could hold.
    expect(height).toBeGreaterThan(vh);
    // And it starts below where the plate ended, not up among the copy.
    expect(top).toBeGreaterThanOrEqual(plateBottom);

    // Nothing at all while the copy is still leaving.
    scrollIntoHold(INNER_END * 0.5);
    expect(drawn()).toBe(0);
    scrollIntoHold(INNER_END);
    expect(drawn()).toBe(0);

    // Drawing by the time the plate is halfway shut.
    scrollIntoHold((INNER_END + HOLD_CLOSE_END) / 2);
    expect(drawn()).toBeGreaterThan(0);
    expect(drawn()).toBeLessThan(1);

    // Head exactly on the bottom edge as the plate finishes shutting.
    scrollIntoHold(HOLD_CLOSE_END);
    const head = top + drawn() * height - hold * HOLD_CLOSE_END;
    // Within a pixel: the reported progress is rounded to three places, which
    // over a rail this long is worth about one.
    expect(Math.abs(head - vh)).toBeLessThan(2);

    // Complete by the time About's panel has arrived.
    scrollIntoHold(aboutTop / hold);
    expect(drawn()).toBe(1);
  });

  it('shows the cue outright under reduced motion, rather than never', () => {
    /*
     * There is no hold to trace the mark across when motion is opted out of,
     * and a cue measured from a hold of zero length stays at zero forever. The
     * handover still has to be signposted -- more so, not less, for a reader
     * who is not being shown the movement that would otherwise imply it.
     */
    reducedMotion.mockReturnValue(true);

    const { getByTestId } = render(<Home />);
    enterHero();

    expect(getByTestId('scroll-cue')).toHaveAttribute('data-progress', '1.000');
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
