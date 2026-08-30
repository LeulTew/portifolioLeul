import { useEffect, useState } from 'react';

/**
 * How far a band has travelled through the viewport: 0 as its top reaches the
 * bottom of the screen, 1 as its bottom leaves the top.
 *
 * Distinct from presence, which is how much of the band is on screen. Presence
 * plateaus while the band is fully visible -- which is exactly right for
 * fading something in and holding it, and useless for anything that has to
 * keep moving while it is being read.
 */
export function transitProgress(
  bandTop: number,
  bandHeight: number,
  rootHeight: number
): number {
  if (!Number.isFinite(bandTop)) return 0;
  if (!Number.isFinite(bandHeight) || bandHeight <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  const span = rootHeight + bandHeight;
  const travelled = (rootHeight - bandTop) / span;
  if (travelled <= 0) return 0;
  return travelled >= 1 ? 1 : travelled;
}

/** Sampling steps. Matched to the coverage observer, and for the same reason. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/** `transitProgress` for a live element, in [0, 1]. */
export function useBandProgress(element: HTMLElement | null): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        const rootHeight =
          entry.rootBounds?.height ??
          (typeof window !== 'undefined' ? window.innerHeight : 0);
        const rect = entry.boundingClientRect;

        setProgress(transitProgress(rect.top, rect.height, rootHeight));
      },
      { threshold: THRESHOLDS }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return progress;
}

/**
 * How close a band is to the middle of the screen: 1 when its centre is on the
 * viewport's centre, falling to 0 either side.
 *
 * A peak, not a plateau, and that distinction is the point. Presence holds at
 * full for as long as the band is on screen, so content driven by it is sharp
 * from the moment it arrives until the moment it starts to leave. Content that
 * should only resolve where it is being looked at needs a value that is only
 * full at one place.
 *
 * `window` is the share of the transit either side of centre over which it
 * falls away, so a smaller window means a sharper focus.
 */
export function centreFocus(progress: number, window = 0.3): number {
  if (!Number.isFinite(progress)) return 0;
  if (!Number.isFinite(window) || window <= 0) return 0;

  const distance = Math.abs(progress - 0.5) / window;
  if (distance >= 1) return 0;

  // Smoothstep, so it settles into focus and out of it rather than arriving
  // and leaving at a constant rate, which reads as a linear wipe.
  const nearness = 1 - distance;
  return nearness * nearness * (3 - 2 * nearness);
}
