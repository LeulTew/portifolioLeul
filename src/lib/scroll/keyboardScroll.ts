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
 * Passive, and it cancels nothing. Which keys scroll, and when a control keeps
 * a key for itself, is `scrollKeyIntent`'s call, shared with the gesture store
 * so the scroll and the chapter request can never disagree. Keys with focus
 * inside the track or another scroller stay the browser's, and a chapter that
 * gives keys a meaning of its own claims them while it does.
 */
import { findScrollContainer, scrollContainerBy } from './scrollContainer';
import { scrollKeyIntent } from './scrollKeys';

type Claim = (event: KeyboardEvent) => boolean;
const claims = new Set<Claim>();

/** Keeps scroll keys for a chapter while `claim` holds; returns the release. */
export function claimScrollKeys(claim: Claim): () => void {
  claims.add(claim);
  return () => { claims.delete(claim); };
}

/** Whether a chapter is keeping this key for itself. */
export function isScrollKeyClaimed(event: KeyboardEvent): boolean {
  for (const claim of claims) if (claim(event)) return true;
  return false;
}

const ARROW_PX = 40;
/** A page keeps an eighth of the view for context, as the browsers' pages do. */
const PAGE_SHARE = 0.875;

function scrolls(element: HTMLElement): boolean {
  const overflow = getComputedStyle(element).overflowY;
  return /auto|scroll|overlay/.test(overflow) && element.scrollHeight > element.clientHeight + 1;
}

/** Whether focus sits in a scroller of its own, other than `track`, which the browser scrolls for the key. */
export function inOwnScroller(target: EventTarget | null, track: HTMLElement | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const scroller = scrolls(target) ? target : findScrollContainer(target);
  return !!scroller && scroller !== track;
}

/**
 * How far the browser would move the track for this key, or 0 when the key is
 * not the track's. Home and End are the story's, not the track's: see `storyKeys`.
 */
export function keyboardScrollDelta(event: KeyboardEvent, track: HTMLElement): number {
  const intent = scrollKeyIntent(event);
  if (!intent || intent.extent === 'document') return 0;
  const target = event.target;
  if (target instanceof Node && track.contains(target)) return 0;
  if (inOwnScroller(target, track)) return 0;
  const sign = intent.direction === 'down' ? 1 : -1;
  if (intent.extent === 'line') return sign * ARROW_PX;
  return sign * track.clientHeight * PAGE_SHARE;
}

export function installKeyboardScroll(track: HTMLElement): () => void {
  const view = track.ownerDocument.defaultView;
  if (!view) return () => {};
  const forward = (event: KeyboardEvent) => {
    const delta = keyboardScrollDelta(event, track);
    if (!delta || isScrollKeyClaimed(event)) return;
    scrollContainerBy(track, delta);
  };
  view.addEventListener('keydown', forward, { passive: true });
  return () => view.removeEventListener('keydown', forward);
}
