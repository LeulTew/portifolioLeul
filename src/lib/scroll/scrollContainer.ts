/**
 * Finding the thing that actually scrolls.
 *
 * This page scrolls inside drei's `ScrollControls` element, not the window, so
 * a control that wants to move the reader cannot just call `window.scrollBy`.
 * It also cannot hard-code that element: the same sections render straight into
 * the document when the 3D layer is off, and then the window *is* the scroller.
 * So walk up from the element and take the first ancestor that can scroll.
 */
import { ownScroll } from './scrollGesture';

/** `null` means the window is the scroller. */
export function findScrollContainer(element: Element | null): HTMLElement | null {
  if (!element || typeof window === 'undefined') return null;

  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }

  return null;
}

/**
 * Moves the given scroller by `delta` pixels.
 *
 * For wheel input over body-level surfaces (the TV reader, Skills, the rail,
 * the hero cue) that sit outside the scroll layer and would otherwise swallow
 * it. Instant: native smooth scrolling fights drei's own damping.
 *
 * A delta worked out from the page's geometry is passed as a function, so it
 * is measured when the move runs: held under a scrollbar thumb, a move measured
 * before it ran landed against a page that had not moved (round 27, TECH-077).
 */
export function scrollContainerBy(
  container: HTMLElement | null,
  delta: number | (() => number)
): void {
  if (typeof delta === 'number' && (!Number.isFinite(delta) || delta === 0)) return;
  const behavior: ScrollBehavior = 'auto';
  const amount = () => {
    const value = typeof delta === 'function' ? delta() : delta;
    return Number.isFinite(value) ? value : 0;
  };

  if (container) {
    ownScroll(() => {
      const top = amount();
      if (top === 0) return;
      if (typeof container.scrollBy === 'function') {
        container.scrollBy({ top, behavior });
      } else {
        container.scrollTop += top;
      }
    });
    return;
  }

  if (typeof window === 'undefined') return;
  if (typeof window.scrollBy === 'function') {
    ownScroll(() => {
      const top = amount();
      if (top !== 0) window.scrollBy({ top, behavior });
    });
  }
}
