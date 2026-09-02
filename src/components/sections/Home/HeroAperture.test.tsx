import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeroAperture } from './HeroAperture';
import { SLIT_SHARE } from '@/lib/motion/heroAperture';

const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion(),
}));

/** Every live observer, so the aperture is reached whatever else observes. */
let observers: Array<(entries: unknown[]) => void> = [];

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

const VIEWPORT = 1000;

/** Drives the observer to report a given share of the viewport covered. */
const cover = (share: number) =>
  act(() => {
    observers.forEach((notify) =>
      notify([
        {
          isIntersecting: share > 0,
          intersectionRect: { height: share * VIEWPORT },
          rootBounds: { height: VIEWPORT },
        },
      ])
    );
  });

/**
 * Waits for the entry animation to finish opening the bands.
 *
 * The open is a real Framer animation on a motion value, so it needs frames.
 * Asserting before it has had any leaves the aperture at its slit, where the
 * scroll has nothing to take away and every reading is identical.
 */
const opened = (element: () => Element | null) =>
  waitFor(
    () => {
      // Exactly zero, not merely close: the open eases asymptotically, and
      // comparing against a value that is still settling races the animation.
      expect(scaleY(element())).toBe(0);
    },
    { timeout: 4000 }
  );

/**
 * Waits for a motion value written this frame to reach the DOM.
 *
 * Framer applies motion values on its own frame loop, so a value set inside
 * `act` is not yet on the element when `act` returns.
 */
const settled = (check: () => void) => waitFor(check, { timeout: 2000 });

const scaleY = (element: Element | null) => {
  const transform = (element as HTMLElement | null)?.style.transform ?? '';
  const match = transform.match(/scaleY\(([-\d.]+)\)/);
  return match ? Number(match[1]) : null;
};

describe('HeroAperture', () => {
  const originalObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    observers = [];
    reducedMotion.mockReturnValue(false);
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      originalObserver;
  });

  it('starts as a slit, with the world showing between the bands', () => {
    // Closed is a letterbox, not a black screen: there is something there from
    // the first frame, and it grows.
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered={false} />);

    expect(scaleY(getByTestId('hero-aperture-top'))).toBeCloseTo(1 - SLIT_SHARE, 4);
    expect(scaleY(getByTestId('hero-aperture-bottom'))).toBeCloseTo(1 - SLIT_SHARE, 4);
  });

  it('moves both bands together', () => {
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered={false} />);

    expect(scaleY(getByTestId('hero-aperture-top'))).toBe(
      scaleY(getByTestId('hero-aperture-bottom'))
    );
  });

  it('renders the seam that lights the two edges apart', () => {
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered={false} />);

    expect(getByTestId('hero-aperture-seam')).toBeInTheDocument();
  });

  it('does not shut while the hero is still arriving', () => {
    /*
     * Coverage is low on the way in as well as on the way out. Reading the
     * first as an exit would slam the aperture shut during its own open.
     */
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered={false} />);

    const before = scaleY(getByTestId('hero-aperture-top'));
    cover(0.2);

    expect(scaleY(getByTestId('hero-aperture-top'))).toBe(before);
  });

  it('holds open while the copy is leaving, then shuts behind it', async () => {
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered />);

    await opened(() => getByTestId('hero-aperture-top'));

    // Fully covering: nothing is leaving yet.
    cover(1);
    const open = scaleY(getByTestId('hero-aperture-top'));

    // Part way out, but inside the window the copy owns.
    cover(0.85);
    await settled(() => {
      expect(scaleY(getByTestId('hero-aperture-top'))).toBe(open);
    });

    // Most of the way gone: the bands are closing.
    cover(0.2);
    await settled(() => {
      expect(scaleY(getByTestId('hero-aperture-top'))!).toBeGreaterThan(open!);
    });

    // Gone: back to the slit it started from.
    cover(0);
    await settled(() => {
      expect(scaleY(getByTestId('hero-aperture-top'))).toBeCloseTo(1 - SLIT_SHARE, 4);
    });
  });

  it('reopens when the reader scrolls back up', async () => {
    const section = document.createElement('section');
    const { getByTestId } = render(<HeroAperture section={section} entered />);

    await opened(() => getByTestId('hero-aperture-top'));

    cover(0);
    await settled(() => {
      expect(scaleY(getByTestId('hero-aperture-top'))).toBeCloseTo(1 - SLIT_SHARE, 4);
    });

    cover(1);
    await settled(() => {
      expect(scaleY(getByTestId('hero-aperture-top'))).toBe(0);
    });
  });

  it('is absent entirely under reduced motion', () => {
    // Decoration, not legibility: it is not present rather than snapping open.
    reducedMotion.mockReturnValue(true);

    const section = document.createElement('section');
    const { queryByTestId } = render(<HeroAperture section={section} entered={false} />);

    expect(queryByTestId('hero-aperture')).toBeNull();
  });

  it('survives having no section to measure', () => {
    const { getByTestId } = render(<HeroAperture section={null} entered={false} />);
    expect(getByTestId('hero-aperture')).toBeInTheDocument();
  });
});
