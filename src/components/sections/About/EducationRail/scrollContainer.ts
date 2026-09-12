/**
 * Finding the thing that actually scrolls.
 *
 * This page scrolls inside drei's `ScrollControls` element, not the window, so
 * a control that wants to move the reader cannot just call `window.scrollBy`.
 * It also cannot hard-code that element: the same sections render straight into
 * the document when the 3D layer is off, and then the window *is* the scroller.
 * So walk up from the element and take the first ancestor that can scroll.
 */

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
 * Only forwards wheel input from the body-level portal. Native smooth scrolling
 * is incompatible with Drei; the record controls never move this scrollport.
 */
export function scrollContainerBy(
  container: HTMLElement | null,
  delta: number
): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const behavior: ScrollBehavior = 'auto';

  if (container) {
    if (typeof container.scrollBy === 'function') {
      container.scrollBy({ top: delta, behavior });
    } else {
      container.scrollTop += delta;
    }
    return;
  }

  if (typeof window === 'undefined') return;
  if (typeof window.scrollBy === 'function') {
    window.scrollBy({ top: delta, behavior });
  }
}
