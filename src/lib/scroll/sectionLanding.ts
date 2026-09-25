/**
 * Where keyboard focus lands when navigation moves the reader to a section.
 *
 * The navbar's buttons left focus behind in the navbar: the next Tab went to
 * the next navbar button and on back through Home, and in the 3D page a scroll
 * key sent to the navbar moved nothing (round 7, D-A11Y-001). An in-page link
 * moves the browser's sequential focus starting point; these buttons do the
 * same, to an element the section marks with `data-section-landing`: its
 * heading, or the reader where the heading belongs to it.
 *
 * A section may mark several candidates, in document order of preference:
 * the TV's screen is the landing while it can be read, and its scene control
 * while the screen is still dark. The first one that can take focus wins.
 *
 * A landing can still be inert or hidden while its chapter settles, so focus
 * waits for one, for about a second, and gives way to the reader's own next
 * key or pointer press.
 */

const ATTEMPT_FRAMES = 60;

let pending: (() => void) | null = null;

/**
 * Whether the element can take focus now, without a layout read: focus() then
 * refuses an element that is not rendered, which `attempt` checks for.
 */
function accepts(element: HTMLElement): boolean {
  if (element.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  return !(element instanceof HTMLButtonElement && element.disabled);
}

/** A section's landing candidates, most preferred first. */
export function sectionLandings(section: string, root: Document = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-section-landing="${section}"]`)];
}

/** Abandons a landing still waiting for its chapter. */
export function cancelSectionLanding(): void {
  pending?.();
}

/** Moves focus to the section's landing, now or once one accepts focus; returns a cancel. */
export function landSectionFocus(section: string, root: Document = document): () => void {
  pending?.();
  const view = root.defaultView;
  if (!view) return () => {};
  let frame = 0;
  let attempts = 0;
  /** Whether landing is over: focus taken, no landing to take it, or the wait spent. */
  const attempt = () => {
    const landings = sectionLandings(section, root);
    if (!landings.length) return true;
    for (const landing of landings) {
      if (!accepts(landing)) continue;
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
