/**
 * Where keyboard focus lands when navigation moves the reader to a section.
 *
 * The navbar's buttons left focus behind in the navbar: the next Tab went to
 * the next navbar button and on back through Home, and in the 3D page a scroll
 * key sent to the navbar moved nothing (round 7, D-A11Y-001). An in-page link
 * moves the browser's sequential focus starting point; these buttons do the
 * same, to the one element each section marks with `data-section-landing`:
 * its heading or section, or the reader where the heading belongs to it.
 *
 * A landing can still be inert or hidden while its chapter settles, so focus
 * waits for it, for about a second, and gives way to the reader's own next key
 * or pointer press.
 */

const ATTEMPT_FRAMES = 60;

let pending: (() => void) | null = null;

/** Whether the element can take focus and be perceived now. */
function accepts(element: HTMLElement): boolean {
  if (element.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  return element.getClientRects().length > 0;
}

export function sectionLanding(section: string, root: Document = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-section-landing="${section}"]`);
}

/** Moves focus to the section's landing, now or once it accepts focus; returns a cancel. */
export function landSectionFocus(section: string, root: Document = document): () => void {
  pending?.();
  const view = root.defaultView;
  if (!view) return () => {};
  let frame = 0;
  let attempts = 0;
  /** Whether landing is over: focus taken, no landing to take it, or the wait spent. */
  const attempt = () => {
    const landing = sectionLanding(section, root);
    if (!landing) return true;
    if (accepts(landing)) {
      landing.focus({ preventScroll: true });
      if (root.activeElement === landing) return true;
    }
    return ++attempts >= ATTEMPT_FRAMES;
  };
  if (attempt()) return () => {};

  const stop = () => {
    view.cancelAnimationFrame(frame);
    root.removeEventListener('keydown', stop, true);
    root.removeEventListener('pointerdown', stop, true);
    if (pending === stop) pending = null;
  };
  const retry = () => {
    frame = 0;
    if (attempt()) stop();
    else frame = view.requestAnimationFrame(retry);
  };
  root.addEventListener('keydown', stop, { capture: true, passive: true });
  root.addEventListener('pointerdown', stop, { capture: true, passive: true });
  pending = stop;
  frame = view.requestAnimationFrame(retry);
  return stop;
}
