import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Home } from './Home';
import { setScrollProgress, resetScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetHeroCue } from '@/lib/motion/heroCue';
import { HERO_SCREENS, HOLD_CLOSE_END, INNER_END } from '@/lib/motion/heroPin';
import { HERO_SEQUENCE, sequenceDuration } from '@/lib/motion/sectionChoreography';

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

  it('gives the hero no hold at all when there is no world behind it', () => {
    /*
     * Reported from Firefox: "WebGL is currently disabled". With no context
     * there is no scene to hand over from, and nothing publishing scroll
     * progress either -- that comes from the canvas's scroll controls. A hero
     * still two screens tall would be a screen of scroll spent going nowhere
     * with the copy standing still at the top of it.
     */
    const { getByTestId } = render(<Home flat />);
    enterHero();

    expect(document.getElementById('home')?.style.getPropertyValue('--hero-screens')).toBe(
      '1'
    );

    // And the copy stays put rather than leaving across a hold that is not there.
    scrollIntoHold(1);
    const content = getByTestId('hero-content');
    expect(content.style.visibility).not.toBe('hidden');
    expect(exitOf(content)).toBe(0);
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

  it('draws the cue while About climbs, not across an empty hero', () => {
    /*
     * Reported five times, and this is the shape that came out of it. The mark
     * is drawn from under the plate, over the stretch where the section
     * underneath is climbing into place, and is complete with its head at rest
     * just above the heading.
     *
     * Every earlier attempt drew it somewhere the reader could not use it: on
     * a hero that was still leaving; below the fold; carried off the top at
     * the release; held, and so capped at the height of the window; and then
     * drawn all the way down an empty hero before About had begun to appear,
     * which read as a very long line pointing at nothing.
     */
    const { getByTestId } = render(<Home />);
    enterHero();
    const plateBottom = 700;
    // Where About actually begins: the hero is `1 + hold` screens tall.
    const aboutTop = window.innerHeight * HERO_SCREENS;
    layOutRail({ plateBottom, aboutTop });

    const cue = () => getByTestId('scroll-cue');
    const drawn = () => Number(cue().dataset.progress);
    const section = document.getElementById('home')!;
    const vh = window.innerHeight;
    const hold = vh * (HERO_SCREENS - 1);

    const top = Number.parseFloat(section.style.getPropertyValue('--cue-top'));
    const height = Number.parseFloat(section.style.getPropertyValue('--cue-height'));

    // Starts under the plate, as the reader saw it while the hero was held.
    expect(top - hold * INNER_END).toBeGreaterThanOrEqual(plateBottom);
    // Shorter than the window it is drawn in.
    expect(height).toBeLessThan(vh);
    expect(height).toBeGreaterThan(0);

    // Nothing while the copy is still leaving.
    scrollIntoHold(INNER_END * 0.5);
    expect(drawn()).toBe(0);
    scrollIntoHold(INNER_END);
    expect(drawn()).toBe(0);

    // Drawing from the moment the plate starts to shut.
    scrollIntoHold(HOLD_CLOSE_END);
    expect(drawn()).toBeGreaterThan(0);
    expect(drawn()).toBeLessThan(1);

    // And the panel is already climbing well before it is finished.
    scrollIntoHold(1);
    expect(drawn()).toBeLessThan(1);

    // Complete, head at rest above the heading, as the stretch takes over.
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

  it('replays fluid faster snow animation when scrolling back up into Home', () => {
    vi.useFakeTimers();
    const { getAllByTestId, container } = render(<Home />);
    enterHero();

    // On first load, LiquidFillText has first load timing
    const titleElements = getAllByTestId('liquid-fill-text');
    expect(titleElements[0]).toHaveAttribute('data-filling', 'true');
    expect(titleElements[0]).toHaveAttribute('data-settled', 'false');
    expect(titleElements[0].style.getPropertyValue('--snow-duration')).toBe('2400ms');
    expect(titleElements[0].style.getPropertyValue('--word-delay')).toBe('1000ms');

    // Settle first load
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(titleElements[0]).toHaveAttribute('data-settled', 'true');

    // Scroll away (leave Home into hold)
    scrollIntoHold(0.5);
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Scroll back up into Home
    scrollIntoHold(0);
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // On re-entry, LiquidFillText remounts with faster fluid timing and starts filling immediately
    const reenteredElements = getAllByTestId('liquid-fill-text');
    expect(reenteredElements[0]).toHaveAttribute('data-filling', 'true');
    expect(reenteredElements[0]).toHaveAttribute('data-settled', 'false');
    expect(reenteredElements[0].style.getPropertyValue('--snow-duration')).toBe('1400ms');
    expect(reenteredElements[0].style.getPropertyValue('--word-delay')).toBe('0ms');

    // The h1 has the titleReentering class during re-entry
    const h1 = container.querySelector('h1');
    expect(h1?.className).toContain('titleReentering');

    // Settle re-entry animation
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(reenteredElements[0]).toHaveAttribute('data-settled', 'true');
    expect(h1?.className).not.toContain('titleReentering');
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

  /*
   * Lets the handover's beats run for a stretch of wall-clock.
   *
   * They are no longer scrubbed from the scroll offset: scroll flips a trigger
   * and the beat plays on its own clock, so a test that scrolls and reads the
   * value on the next line is asking before anything has had time to happen.
   */
  const playBeats = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  const HANDOVER_MS = 2200;

  it('finishes the exit inside the hold, not after it', () => {
    /*
     * Everything the hero does has to be done while it is still being held and
     * looked at, which is the whole reason for holding it. And there has to be
     * hold left afterwards, for the cue.
     */
    vi.useFakeTimers();
    try {
      const { container } = render(<Home />);
      enterHero();

      scrollIntoHold(HOLD_CLOSE_END);
      playBeats(HANDOVER_MS);

      const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
      expect(exitOf(content)).toBe(1);
      expect(content.style.visibility).toBe('hidden');
      expect(content.style.pointerEvents).toBe('none');
      // The container itself no longer animates; the layers do.
      expect(content.style.filter).toBe('');
      expect(content.style.transform).toBe('');
      expect(HOLD_CLOSE_END).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays the exit on a continuous value rather than switching it', () => {
    // Part way through is part way out: the layers stagger off a continuous
    // value, so it has to be continuous -- it is simply continuous in time now
    // rather than in scroll.
    vi.useFakeTimers();
    try {
      const { container } = render(<Home />);
      enterHero();

      scrollIntoHold(0.2);
      playBeats(250);

      const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
      expect(exitOf(content)).toBeGreaterThan(0);
      expect(exitOf(content)).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('carries on leaving while the reader holds perfectly still', () => {
    /*
     * The point of the change. A scrubbed exit stops dead the instant the
     * wheel does, so the hero sat frozen half-gone; and because a wheel notch
     * is a discrete hundred-pixel jump, the part that did move arrived in
     * lumps. Time drives it now, so one notch past the trigger buys the whole
     * movement.
     */
    vi.useFakeTimers();
    try {
      const { container } = render(<Home />);
      enterHero();

      scrollIntoHold(0.2);
      playBeats(200);

      const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
      const early = exitOf(content);

      // Not one further pixel of scroll from here.
      playBeats(300);
      expect(exitOf(content)).toBeGreaterThan(early);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not let a harder scroll hurry the exit along', () => {
    /*
     * Scroll says whether, not how far. Two readers who cross the trigger at
     * wildly different speeds must see the same movement take the same time --
     * which is exactly what a scrub cannot promise.
     */
    vi.useFakeTimers();
    try {
      const gentle = render(<Home />);
      enterHero();
      scrollIntoHold(0.15);
      playBeats(300);
      const gentleExit = exitOf(
        gentle.container.querySelector('[data-testid="hero-content"]') as HTMLElement
      );
      gentle.unmount();

      const hurried = render(<Home />);
      enterHero();
      scrollIntoHold(0.38);
      playBeats(300);
      const hurriedExit = exitOf(
        hurried.container.querySelector('[data-testid="hero-content"]') as HTMLElement
      );

      /*
       * Within a frame of each other. The tolerance is one rAF step of the
       * beat (16.7 of 900, so about 0.019) and not tighter, because which side
       * of a frame boundary each render lands on is not part of the contract.
       */
      expect(gentleExit).toBeGreaterThan(0);
      expect(Math.abs(hurriedExit - gentleExit)).toBeLessThan(0.02);

      /*
       * And nowhere near what a scrub would have given. The hurried reader
       * crossed 2.5x as much hold, so the old `progress / INNER_END` would
       * have put them 2.5x further out -- which is the difference this whole
       * change is about.
       */
      expect(hurriedExit / gentleExit).toBeLessThan(1.2);
      expect(0.38 / 0.15).toBeGreaterThan(2.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('disperses the plate only once the copy has finished leaving', () => {
    /*
     * The order the whole handover is built on: the copy goes, and only then
     * does the ground it stood on disperse. Shutting the plate under standing
     * copy pulls the floor out from under it.
     */
    vi.useFakeTimers();
    try {
      const { container } = render(<Home />);
      enterHero();

      const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;

      scrollIntoHold(HOLD_CLOSE_END);
      playBeats(120);

      expect(exitOf(content)).toBeLessThan(1);
      expect(Number(content.style.getPropertyValue('--shut'))).toBe(0);

      playBeats(HANDOVER_MS);
      expect(exitOf(content)).toBe(1);
      expect(Number(content.style.getPropertyValue('--shut'))).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hands over to the exit even if the reader scrolls before it has settled', () => {
    /*
     * The first-load bug, and it was a wide window: measured against the real
     * app, the hero is up and scrolling is unlocked about 170ms later, but the
     * settle backstop does not fire for another five and a third seconds.
     *
     * Every rule that reads `--exit` and `--shut` is scoped to `.settled`, so
     * a reader who scrolled inside that window drove both numbers into a
     * stylesheet nothing was listening to. The hero rode the pin, and then
     * snapped to wherever the numbers had already got to when the timer
     * finally landed. It could only ever happen once, because on any later
     * visit the class is already on -- which is exactly how it was reported.
     */
    vi.useFakeTimers();
    try {
      const { container } = render(<Home />);
      enterHero();

      const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;
      expect(content.className).not.toMatch(/settled/);

      scrollIntoHold(0.2);
      playBeats(300);

      // Well inside the backstop, so this can only be the handover itself.
      expect((sequenceDuration(HERO_SEQUENCE) + 0.8) * 1000).toBeGreaterThan(300);
      expect(content.className).toMatch(/settled/);
      expect(exitOf(content)).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
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

    /*
     * And not before a real entrance could have finished.
     *
     * This backstop used to be armed at mount with the sequence's own
     * duration, which is the first-load glitch: the entrance starts when the
     * observer reports, and on a hard refresh that can be a second late, so
     * the backstop fired mid-sequence and snapped every layer to its finished
     * state. It waits far longer now, and restarts when the entrance actually
     * begins.
     */
    act(() => vi.advanceTimersByTime(8000));
    expect(content.className).not.toMatch(/settled/);

    // Never entered: no observer callback is delivered at all.
    act(() => vi.advanceTimersByTime(9000));
    expect(content.className).toMatch(/settled/);
  });

  it('gives a late entrance its full sequence before settling', () => {
    /*
     * The glitch itself. The entrance is triggered by the observer, which on a
     * first load arrives well after mount -- so the settle has to be measured
     * from the entrance, not from the mount, or it cuts the sequence short and
     * the hero appears to flash and vanish.
     */
    vi.useFakeTimers();
    const { container } = render(<Home />);
    const content = container.querySelector('[data-testid="hero-content"]') as HTMLElement;

    // A second and a half of heavy first-load work before the observer reports.
    act(() => vi.advanceTimersByTime(1500));
    enterHero();

    // Most of the way through the sequence, and still playing.
    act(() => vi.advanceTimersByTime(sequenceDuration(HERO_SEQUENCE) * 1000 * 0.8));
    expect(content.className).not.toMatch(/settled/);

    // Then finished, on its own terms.
    act(() => vi.advanceTimersByTime(sequenceDuration(HERO_SEQUENCE) * 1000));
    expect(content.className).toMatch(/settled/);
  });
});
