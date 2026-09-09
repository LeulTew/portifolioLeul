/**
 * Cheap access to the pinned sequence's published progress, and to the section
 * every About stage writes its state onto.
 *
 * Both are read from inside the render loop. `setScrollProgress` publishes from
 * `useFrame`, so every subscriber's per-frame work runs synchronously before
 * the WebGL draw -- which is why the lookups these replace mattered. Each
 * stage used to resolve `--seq` by walking `closest()`, then scanning the whole
 * document with `[data-testid*="sequence-overlay"]` and
 * `[data-active="true"][style*="--seq"]` -- two attribute-substring matches
 * over every element -- and then falling through to `getComputedStyle`, which
 * flushes style. Three stages doing that on every frame is most of a frame
 * budget spent finding a number that one node already had.
 *
 * The nodes are resolved once and remembered, and re-resolved only if they
 * leave the document.
 */

import { cachedElement } from '@/lib/dom/cachedElement';

/** Reads `--seq` for a node inside a `PinnedSequence`. */
export function createSeqReader(getContainer: () => HTMLElement | null): () => number {
  let resolvedFor: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;

  return () => {
    const container = getContainer();
    if (!container) return 0;

    // Set directly on the node in a couple of tests, and cheapest to check.
    const own = container.style.getPropertyValue('--seq').trim();
    if (own) return Number.parseFloat(own) || 0;

    // Keyed on the container too, not just on the overlay still being
    // attached: these components are portalled, so a remount hands back a
    // different container whose overlay may be a different node again.
    if (resolvedFor !== container || !overlay?.isConnected) {
      overlay = container.closest<HTMLElement>('[data-active]');
      resolvedFor = container;
    }

    const raw = overlay?.style.getPropertyValue('--seq').trim();
    return raw ? Number.parseFloat(raw) || 0 : 0;
  };
}

/**
 * The About section, looked up once.
 *
 * Every stage writes its `data-*` state here and reads its siblings' back, so
 * this was several `getElementById` calls per frame per stage.
 */
export function createAboutReader(): () => HTMLElement | null {
  return cachedElement(() =>
    typeof document === 'undefined' ? null : document.getElementById('about')
  );
}
