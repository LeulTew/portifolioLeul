import { useEffect } from 'react';
import { subscribeSectionNavigation } from './sectionNavigation';

const SECTIONS = ['home', 'about', 'skills', 'projects', 'contact'] as const;

interface ResizeAnchor {
  id: string;
  /** How far through the section the viewport centre sits; past 1 in a gap after it. */
  ratio: number;
  width: number;
  height: number;
}

function readAnchor(): ResizeAnchor | null {
  const center = window.innerHeight / 2;
  let anchor: ResizeAnchor | null = null;
  for (const id of SECTIONS) {
    const rect = document.getElementById(id)?.getBoundingClientRect();
    if (!rect || rect.height <= 0 || rect.top > center) continue;
    anchor = { id, ratio: (center - rect.top) / rect.height, width: window.innerWidth, height: window.innerHeight };
  }
  return anchor;
}

/**
 * Keeps a flat-page reader in the same place through a window resize, and
 * through a change of motion preference.
 *
 * Every section is sized against the viewport, and a changed `min-height` on
 * an ancestor suppresses the browser's own scroll anchoring -- so a shorter
 * window kept the raw offset and dropped a reader of Projects into Contact.
 * The anchor is the section under the viewport centre and how far through it
 * that centre sits.
 *
 * Turning reduced motion off re-stages Skills as a tall pinned track above
 * the reader, and the browser's anchoring then carried a reader of Projects
 * 3,300px on into Contact with focus left behind (round 11, D-NAV-002). The
 * anchor is taken as the preference changes, before any chapter re-renders,
 * and held every frame while the chapters rebuild, until the reader moves.
 */
export function useResizeAnchor(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let anchor = readAnchor();
    let sampling = 0;
    let settling = 0;
    let holding = 0;
    let holdUntil = 0;

    const sample = () => {
      sampling = 0;
      // Scrolls the browser makes while clamping a resize are not the reader's.
      if (settling || holding || (anchor && (anchor.width !== window.innerWidth || anchor.height !== window.innerHeight))) return;
      anchor = readAnchor();
    };
    const onScroll = () => {
      if (!sampling) sampling = requestAnimationFrame(sample);
    };
    const restore = () => {
      if (!anchor) return;
      const rect = document.getElementById(anchor.id)?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const drift = rect.top + anchor.ratio * rect.height - window.innerHeight / 2;
      if (Math.abs(drift) >= 1) window.scrollBy({ top: drift, behavior: 'instant' });
    };
    const onResize = () => {
      restore();
      if (anchor) anchor = { ...anchor, width: window.innerWidth, height: window.innerHeight };
      // Sections finish re-measuring over the next frame; hold the anchor until then.
      cancelAnimationFrame(settling);
      settling = requestAnimationFrame(() => {
        settling = 0;
        restore();
      });
    };

    const release = () => {
      cancelAnimationFrame(holding);
      holding = 0;
      // A resize still settling would restore the old place over the new one (round 15, TECH-052);
      // the next scroll samples the anchor afresh.
      cancelAnimationFrame(settling);
      settling = 0;
    };
    const hold = (now: number) => {
      if (!holding) return;
      restore();
      holding = now < holdUntil ? requestAnimationFrame(hold) : 0;
    };
    const motion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const onMotion = () => {
      // The last anchor the reader's scrolling left, not one read now: the stylesheet's own
      // reduced-motion rules have already re-laid the page before this event arrives.
      anchor ??= readAnchor();
      holdUntil = performance.now() + MOTION_HOLD_MS;
      if (!holding) holding = requestAnimationFrame(hold);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Capture runs before the chapters' own resize listeners, which would
    // otherwise act on the raw offset -- a position inside another chapter.
    window.addEventListener('resize', onResize, { capture: true });
    motion?.addEventListener?.('change', onMotion);
    // The reader's own input ends a hold at once, and so does a navigation, which places
    // the reader itself: Skills continuing its reader after the change (round 14, D-MOTION-001).
    for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart'] as const) {
      window.addEventListener(type, release, { capture: true, passive: true });
    }
    const stopNavigation = subscribeSectionNavigation(release);
    return () => {
      cancelAnimationFrame(sampling);
      cancelAnimationFrame(settling);
      release();
      stopNavigation();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize, { capture: true });
      motion?.removeEventListener?.('change', onMotion);
      for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart'] as const) {
        window.removeEventListener(type, release, { capture: true });
      }
    };
  }, [enabled]);
}

/** How long a motion-preference change holds the reader's place while the chapters rebuild. */
export const MOTION_HOLD_MS = 1200;
