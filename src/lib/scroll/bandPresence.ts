import { useViewportShare } from './viewportCoverage';
import { useEffect, useState } from 'react';

/**
 * How present a band of content is: 0 as it approaches, 1 while it is centred,
 * 0 again as it leaves.
 *
 * Distinct from `useViewportShare`, which is the share of the VIEWPORT the
 * element covers. A row half a screen tall can never exceed a share of 0.5, so
 * driving an opacity from the share directly means it never reaches full --
 * the band would sit permanently half-faded. This rescales by the most the
 * band could ever cover, so a band that is entirely on screen counts as fully
 * present whatever its height.
 *
 * The result plateaus rather than peaking, which is the shape wanted here: the
 * content should arrive, hold while it is being read, and leave -- not crest at
 * one exact scroll position and immediately start receding.
 */
export function bandPresence(
  share: number,
  bandHeight: number,
  rootHeight: number
): number {
  if (!Number.isFinite(share) || share <= 0) return 0;
  if (!Number.isFinite(bandHeight) || bandHeight <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  // A band taller than the screen is fully present once it fills the screen.
  const reachable = Math.min(bandHeight / rootHeight, 1);
  if (reachable <= 0) return 0;

  const presence = share / reachable;
  return presence >= 1 ? 1 : presence;
}

/**
 * The band's own height, measured from the element rather than assumed.
 *
 * Read on resize as well as on mount: the columns reflow at every breakpoint,
 * and a stale height silently rescales the presence curve -- the band would
 * reach full early and hold, or never reach it at all.
 */
function useBandHeight(element: HTMLElement | null): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') {
      if (element) setHeight(element.getBoundingClientRect().height);
      return;
    }

    const observer = new ResizeObserver(() => {
      setHeight(element.getBoundingClientRect().height);
    });

    observer.observe(element);
    setHeight(element.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [element]);

  return height;
}

/** `bandPresence` for a live element, in [0, 1]. */
export function useBandPresence(element: HTMLElement | null): number {
  const share = useViewportShare(element);
  const bandHeight = useBandHeight(element);
  const rootHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  return bandPresence(share, bandHeight, rootHeight);
}
