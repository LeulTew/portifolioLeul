import { useEffect, useState } from 'react';

/**
 * Which section the reader is currently in.
 *
 * Chosen by how much of a focus band each section fills, in pixels -- never by
 * IntersectionObserver's `intersectionRatio`, which is a fraction of the
 * observed element. Against a threshold list, a section taller than about
 * twice the band can never reach the lowest threshold and is skipped
 * altogether, so the tallest sections on the page are exactly the ones that
 * silently never activate.
 */

/** Focus band, as a share of the viewport trimmed from the top and bottom. */
const BAND_INSET = '-45%';

/** Sections are re-looked-up on this interval until they exist. */
const RETRY_MS = 250;

export function useActiveSection(sectionIds: readonly string[]): string {
  const key = sectionIds.join(',');
  const [active, setActive] = useState(() => sectionIds[0] ?? '');

  useEffect(() => {
    const ids = key.split(',').filter(Boolean);
    if (ids.length === 0 || typeof IntersectionObserver === 'undefined') return;

    let observer: IntersectionObserver | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    /** Remembered per section: a callback only reports what changed. */
    const visible = new Map<string, number>();

    const attach = () => {
      const sections = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      // The sections mount after the loader clears, so keep looking.
      if (sections.length === 0) {
        retry = setTimeout(attach, RETRY_MS);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).id;
            visible.set(id, entry.isIntersecting ? (entry.intersectionRect?.height ?? 0) : 0);
          }

          let bestId = '';
          let bestHeight = 0;
          for (const [id, height] of visible) {
            if (height > bestHeight) {
              bestHeight = height;
              bestId = id;
            }
          }

          if (bestHeight > 0 && bestId) {
            setActive((previous) => (previous === bestId ? previous : bestId));
          }
        },
        { rootMargin: `${BAND_INSET} 0px ${BAND_INSET} 0px`, threshold: 0 }
      );

      sections.forEach((section) => observer?.observe(section));
    };

    attach();

    return () => {
      if (retry) clearTimeout(retry);
      observer?.disconnect();
    };
  }, [key]);

  return active;
}
