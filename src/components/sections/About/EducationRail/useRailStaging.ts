import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';

/** Below this the rail stops being a rail and the records read down the page. */
export const RAIL_BREAKPOINT = 900;

/**
 * Whether the rail should be staged -- held on a fixed overlay, crossing one
 * record at a time -- or simply laid out down the page.
 *
 * Both answers are "no" for the same reason from the reader's point of view:
 * a phone has no room for a three-column record, and a reader who has asked
 * for less motion has asked not to be held still while something moves.
 */
export function useRailStaged(): boolean {
  const reducedMotion = usePrefersReducedMotion();
  const [wideEnough, setWideEnough] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia(`(max-width: ${RAIL_BREAKPOINT}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia(`(max-width: ${RAIL_BREAKPOINT}px)`);
    const update = () => setWideEnough(!query.matches);
    update();

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener('change', update);
    }

    const legacy = query as unknown as {
      addListener?: (fn: () => void) => void;
      removeListener?: (fn: () => void) => void;
    };
    legacy.addListener?.(update);
    return () => legacy.removeListener?.(update);
  }, []);

  return wideEnough && !reducedMotion;
}
