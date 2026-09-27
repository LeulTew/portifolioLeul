import type { ScrollDirection } from './scrollKeys';
import { subscribeSectionNavigation } from './sectionNavigation';
import { LAYOUT_SETTLE_MS } from './layoutSettle';

/**
 * Tells the chapters when the reader has moved on from the last navigation.
 *
 * A staged chapter steps aside for a navigation (its `bypass`), so a jump across
 * it is not taken over mid-flight, and until now only the reader's next gesture
 * ended that. A move with no gesture -- a click on the scrollbar track, the
 * browser's find, a restored position -- carried the page on with every chapter
 * still stepped aside: after the navbar's About, a jump into About's hand-off or
 * into Skills rested on a blank green or empty chapter for good (round 34,
 * D-R34-001).
 *
 * So the navigation's hold ends once the reader has moved the page a clear
 * distance from where it left them, and the chapters hear it as the start of a
 * gesture in that direction. Where it left them is where the page came
 * to rest after it: a navigation's own glide, or its settling, is not the reader
 * moving on. Only the story's own scroller counts -- the flat page's document,
 * or the 3D page's full-window scroll track -- never a reader box inside a
 * chapter.
 */

/** Which way the reader went from the landing, as a gesture's direction would say. */
type Listener = (direction: ScrollDirection) => void;

const listeners = new Set<Listener>();
/** Where the page rested after the last navigation, once it has. */
let landed: number | null = null;
/** Whether a navigation's hold is still waiting to be ended. */
let holding = false;
let settling: ReturnType<typeof setTimeout> | undefined;
let lastTop = 0;
/** The story scroller last seen moving: the document, or the 3D page's track. */
let scroller: EventTarget | null = null;
let stopNavigation: (() => void) | null = null;

/** How far from the landing the page has to go to have been moved on from it. */
export function movedOnDistance(viewportHeight: number): number {
  return Math.max(120, viewportHeight / 3);
}

function storyTop(target: EventTarget | null): number | null {
  if (typeof document === 'undefined') return null;
  if (target === document || target === document.documentElement || target === document.body) {
    return (document.scrollingElement ?? document.documentElement).scrollTop;
  }
  // The 3D page scrolls one full-window track; readers inside chapters scroll boxes far smaller.
  if (target instanceof Element && target.clientHeight >= window.innerHeight * 0.8) return target.scrollTop;
  return null;
}

function settle(): void {
  clearTimeout(settling);
  settling = setTimeout(() => {
    settling = undefined;
    if (holding && landed === null) landed = lastTop;
  }, LAYOUT_SETTLE_MS);
}

function onScroll(event: Event): void {
  const top = storyTop(event.target);
  if (top === null) return;
  scroller = event.target;
  lastTop = top;
  if (!holding) return;
  if (landed === null) {
    settle();
    return;
  }
  if (Math.abs(top - landed) < movedOnDistance(window.innerHeight)) return;
  const direction: ScrollDirection = top > landed ? 'down' : 'up';
  holding = false;
  landed = null;
  for (const listener of [...listeners]) listener(direction);
}

function start(): void {
  if (stopNavigation || typeof window === 'undefined') return;
  stopNavigation = subscribeSectionNavigation(() => {
    holding = true;
    landed = null;
    // A navigation that does not move the page has landed where it is.
    lastTop = (scroller && storyTop(scroller)) ?? lastTop;
    settle();
  });
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
}

function stop(): void {
  if (!stopNavigation) return;
  stopNavigation();
  stopNavigation = null;
  window.removeEventListener('scroll', onScroll, { capture: true });
  clearTimeout(settling);
  settling = undefined;
  holding = false;
  landed = null;
  scroller = null;
  lastTop = 0;
}

/**
 * Hears the reader leaving the last navigation's landing, by any means, once per
 * navigation. A chapter ends its step aside here, as it does on a gesture.
 */
export function subscribeNavigationLeft(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Test-only: forgets every listener and any navigation being held. */
export function resetNavigationLeft(): void {
  listeners.clear();
  stop();
}
