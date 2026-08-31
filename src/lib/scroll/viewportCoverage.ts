import { useEffect, useRef, useState } from 'react';

/**
 * Share of the viewport a section must cover before the scrim reaches full
 * strength. Below this the scene stays legible around the copy.
 */
export const FULL_FOCUS_COVERAGE = 0.55;

/**
 * Maps how much of the *viewport* a section occupies onto scrim strength.
 *
 * Deliberately not IntersectionObserver's `intersectionRatio`, which is a
 * fraction of the observed element: a section six screens tall can never exceed
 * a ratio of ~0.17 no matter how completely it fills the screen.
 */
export function focusStrength(
  intersectionHeight: number,
  rootHeight: number,
  fullCoverage: number = FULL_FOCUS_COVERAGE
): number {
  if (!Number.isFinite(intersectionHeight) || intersectionHeight <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  const coverage = intersectionHeight / rootHeight;
  if (fullCoverage <= 0) return 1;

  const strength = coverage / fullCoverage;
  if (strength <= 0) return 0;
  return strength >= 1 ? 1 : strength;
}


/**
 * Coverage steps sampled by the observer.
 *
 * IntersectionObserver only reports when a threshold is crossed, so this is
 * the sampling rate of every scroll-driven value in the DOM layer -- and the
 * thresholds are fractions of the ELEMENT, not of the scroll. A section taller
 * than the viewport spends its whole transit inside a handful of steps at 21,
 * so anything scrubbed by it advances in a few large jumps: a line meant to be
 * drawn by the scroll appears in two or three slides instead.
 *
 * A hundred steps is still one observer and one callback per crossing.
 */
export const COVERAGE_STEPS = 101;

const THRESHOLDS = Array.from(
  { length: COVERAGE_STEPS },
  (_, i) => i / (COVERAGE_STEPS - 1)
);

/**
 * The raw share of the viewport `element` occupies, in [0, 1].
 *
 * The single source of viewport-relative section progress for the DOM layer.
 * framer-motion's `useScroll` cannot serve this role here: it tracks the
 * viewport's own scroll, and this page scrolls inside the ScrollControls
 * element, so its progress is pinned at 0 and every transform derived from it
 * silently freezes at its starting value.
 */
/** The share of the viewport `entry`'s target occupies, in [0, 1]. */
function shareFromEntry(entry: IntersectionObserverEntry): number {
  const rootHeight =
    entry.rootBounds?.height ??
    (typeof window !== 'undefined' ? window.innerHeight : 0);

  const visibleHeight = entry.isIntersecting
    ? (entry.intersectionRect?.height ?? 0)
    : 0;

  return rootHeight > 0 ? Math.min(visibleHeight / rootHeight, 1) : 0;
}

/**
 * Reports the viewport share of `element` to a callback, without re-rendering.
 *
 * Prefer this to `useViewportShare` for anything that ends up as a style. A
 * hundred thresholds is a hundred state updates per transit, and a section's
 * scrim, opacity or scale is a value React has no reason to see: routing it
 * through state re-renders the entire section -- for Projects, that means
 * rebuilding thirty rail items and reconciling the whole carousel -- to change
 * a number the compositor could have taken directly.
 *
 * The callback is held in a ref, so a caller may pass an inline function
 * without tearing down and rebuilding the observer on every render.
 */
export function useViewportShareEffect(
  element: HTMLElement | null,
  onChange: (share: number) => void
): void {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        callbackRef.current(shareFromEntry(entry));
      },
      { threshold: THRESHOLDS }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
}

export function useViewportShare(element: HTMLElement | null): number {
  const [share, setShare] = useState(0);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        setShare(shareFromEntry(entry));
      },
      { threshold: THRESHOLDS }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return share;
}

/**
 * Scrim strength for `element`: viewport share, rescaled so a section that
 * covers most of the screen counts as fully in focus.
 *
 * Distinct from the raw share on purpose. This curve is tuned for how opaque a
 * scrim should be, and using it to drive an exit made the hero hold at full
 * opacity until it was already 45% gone.
 */
export function useViewportCoverage(element: HTMLElement | null): number {
  const share = useViewportShare(element);
  return focusStrength(share, 1);
}
