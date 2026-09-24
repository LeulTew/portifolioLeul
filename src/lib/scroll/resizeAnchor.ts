import { useEffect } from 'react';

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
 * Keeps a flat-page reader in the same place through a window resize.
 *
 * Every section is sized against the viewport, and a changed `min-height` on
 * an ancestor suppresses the browser's own scroll anchoring -- so a shorter
 * window kept the raw offset and dropped a reader of Projects into Contact.
 * The anchor is the section under the viewport centre and how far through it
 * that centre sits.
 */
export function useResizeAnchor(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let anchor = readAnchor();
    let sampling = 0;
    let settling = 0;

    const sample = () => {
      sampling = 0;
      // Scrolls the browser makes while clamping a resize are not the reader's.
      if (settling || (anchor && (anchor.width !== window.innerWidth || anchor.height !== window.innerHeight))) return;
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

    window.addEventListener('scroll', onScroll, { passive: true });
    // Capture runs before the chapters' own resize listeners, which would
    // otherwise act on the raw offset -- a position inside another chapter.
    window.addEventListener('resize', onResize, { capture: true });
    return () => {
      cancelAnimationFrame(sampling);
      cancelAnimationFrame(settling);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize, { capture: true });
    };
  }, [enabled]);
}
