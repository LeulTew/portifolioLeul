/**
 * Scroll keys that reach the 3D story from outside it.
 *
 * The 3D page scrolls drei's track, not the document, and the browser sends a
 * scroll key to the scroller that holds focus. With focus on the body (a fresh
 * load) or the navbar, both outside the track, PageDown, Space and the arrows
 * scrolled nothing: 52 presses left the story on its first frame (round 7,
 * D-A11Y-001). Those keys are forwarded to the track at the browser's own
 * distances, as the body-level surfaces already forward the wheel.
 *
 * Passive, and it cancels nothing. Keys with focus inside the track stay the
 * browser's, and so do keys a control uses itself; a chapter that gives keys
 * a meaning of its own claims them while it does.
 */
import { findScrollContainer, scrollContainerBy } from './scrollContainer';

type Claim = (event: KeyboardEvent) => boolean;
const claims = new Set<Claim>();

/** Keeps scroll keys for a chapter while `claim` holds; returns the release. */
export function claimScrollKeys(claim: Claim): () => void {
  claims.add(claim);
  return () => { claims.delete(claim); };
}

const ARROW_PX = 40;
/** A page keeps an eighth of the view for context, as the browsers' pages do. */
const PAGE_SHARE = 0.875;

/** Controls that give these keys a meaning of their own. */
const KEYED_CONTROLS = [
  'input', 'textarea', 'select', '[contenteditable]:not([contenteditable="false"])',
  ...['slider', 'spinbutton', 'listbox', 'menu', 'menubar', 'tablist', 'radiogroup', 'grid', 'tree', 'treegrid', 'combobox']
    .map(role => `[role="${role}"]`),
  '[data-projects-display]', '[data-projects-tabs]',
].join(',');
const SPACE_ACTIVATES = [
  'button', 'summary',
  ...['button', 'checkbox', 'switch', 'radio', 'tab', 'menuitem', 'option'].map(role => `[role="${role}"]`),
].join(',');

function scrolls(element: HTMLElement): boolean {
  const overflow = getComputedStyle(element).overflowY;
  return /auto|scroll|overlay/.test(overflow) && element.scrollHeight > element.clientHeight + 1;
}

/** How far the browser would move the track for this key, or 0 when the key is not the track's. */
export function keyboardScrollDelta(event: KeyboardEvent, track: HTMLElement): number {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return 0;
  const space = event.key === ' ' || event.key === 'Spacebar';
  if (event.shiftKey && !space) return 0;
  const target = event.target;
  if (target instanceof Node && track.contains(target)) return 0;
  if (target instanceof HTMLElement) {
    if (target.closest(KEYED_CONTROLS) || (space && target.closest(SPACE_ACTIVATES))) return 0;
    const scroller = scrolls(target) ? target : findScrollContainer(target);
    if (scroller && scroller !== track) return 0;
  }
  const page = track.clientHeight * PAGE_SHARE;
  switch (event.key) {
    case 'ArrowDown': return ARROW_PX;
    case 'ArrowUp': return -ARROW_PX;
    case 'PageDown': return page;
    case 'PageUp': return -page;
    case ' ': case 'Spacebar': return event.shiftKey ? -page : page;
    case 'Home': return -track.scrollTop;
    case 'End': return track.scrollHeight - track.clientHeight - track.scrollTop;
    default: return 0;
  }
}

export function installKeyboardScroll(track: HTMLElement): () => void {
  const view = track.ownerDocument.defaultView;
  if (!view) return () => {};
  const forward = (event: KeyboardEvent) => {
    const delta = keyboardScrollDelta(event, track);
    if (!delta) return;
    for (const claim of claims) if (claim(event)) return;
    scrollContainerBy(track, delta);
  };
  view.addEventListener('keydown', forward, { passive: true });
  return () => view.removeEventListener('keydown', forward);
}
