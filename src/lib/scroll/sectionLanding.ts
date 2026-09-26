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
 * waits for one, for as long as the longest authored arrival, and gives way
 * to the reader's own next key, pointer, wheel or touch, and to a navigation
 * elsewhere published meanwhile (round 14, TECH-045).
 */
import { sectionNavigationSerial, subscribeSectionNavigation } from './sectionNavigation';

/**
 * How long a landing waits for its chapter, in milliseconds of visible time:
 * past the TV's 2.2-second turn toward the reader, the longest arrival a
 * landing waits on. Measured in time, not frames, which gave up after one
 * second at 60 Hz and sooner on faster displays -- before the TV could take
 * focus (round 9, TECH-025).
 *
 * But not in wall-clock time either: the chapters' own movements advance on
 * visible frame time, capped per frame, and stop while the tab is hidden, so a
 * wall clock retired the landing mid-turn after a tab switch or on a display
 * painting every 150ms (round 9, TECH-026). The wait ages by the same capped
 * visible frames, and not at all while the destination says it is still
 * arriving (`data-arriving` on its reader).
 */
export const LANDING_WAIT_MS = 5000;

/** The most one frame ages the wait: a hidden tab or a stalled frame counts as one frame. */
export const LANDING_FRAME_CAP_MS = 100;

/** The reader's own moves, any of which outranks a landing still waiting. */
const READER_INPUTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

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
  let last = view.performance.now();
  let waited = 0;
  let visible = 0;
  const arriving = () => Boolean(root.querySelector(`[data-section-owner="${section}"][data-arriving]`));
  /** Whether landing is over: focus taken, no landing to take it, or the wait spent. */
  const attempt = (now: number) => {
    const landings = sectionLandings(section, root);
    if (!landings.length) return true;
    for (const landing of landings) {
      if (!accepts(landing)) continue;
      landing.focus({ preventScroll: true });
      if (root.activeElement === landing) return true;
    }
    const step = root.hidden ? 0 : Math.min(Math.max(0, now - last), LANDING_FRAME_CAP_MS);
    last = now;
    visible += step;
    if (!arriving()) waited += step;
    // An arrival that never ends still lets go, after four waits' worth of visible time.
    return waited >= LANDING_WAIT_MS || visible >= LANDING_WAIT_MS * 4;
  };
  if (attempt(last)) return () => {};

  let stopNavigation = () => {};
  const stop = () => {
    view.cancelAnimationFrame(frame);
    stopNavigation();
    for (const type of READER_INPUTS) root.removeEventListener(type, stop, true);
    if (pending === stop) pending = null;
  };
  const retry = (now: number) => {
    frame = 0;
    if (attempt(now)) stop();
    else frame = view.requestAnimationFrame(retry);
  };
  for (const type of READER_INPUTS) root.addEventListener(type, stop, { capture: true, passive: true });
  // A newer destination outranks this one; a repeat of this one, such as a replay, keeps it. A
  // navigation already under way when this began -- the one that asked for it, or an older one
  // still being delivered around it -- is not newer.
  const startedAt = sectionNavigationSerial();
  stopNavigation = subscribeSectionNavigation(target => {
    if (sectionNavigationSerial() > startedAt && target !== section) stop();
  });
  pending = stop;
  frame = view.requestAnimationFrame(retry);
  return stop;
}
