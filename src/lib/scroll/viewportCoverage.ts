import { useEffect, useState } from 'react';

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


/** Coverage steps sampled by the observer. More steps means a smoother ramp. */
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * The raw share of the viewport `element` occupies, in [0, 1].
 *
 * The single source of viewport-relative section progress for the DOM layer.
 * framer-motion's `useScroll` cannot serve this role here: it tracks the
 * viewport's own scroll, and this page scrolls inside the ScrollControls
 * element, so its progress is pinned at 0 and every transform derived from it
 * silently freezes at its starting value.
 */
export function useViewportShare(element: HTMLElement | null): number {
  const [share, setShare] = useState(0);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        const rootHeight =
          entry.rootBounds?.height ??
          (typeof window !== 'undefined' ? window.innerHeight : 0);

        const visibleHeight = entry.isIntersecting
          ? (entry.intersectionRect?.height ?? 0)
          : 0;

        setShare(
          rootHeight > 0 ? Math.min(visibleHeight / rootHeight, 1) : 0
        );
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
