/**
 * How far the fixed navbar reaches down the window, in CSS pixels.
 *
 * Keyboard reveals must leave a control below it (WCAG 2.4.11, focus not
 * obscured): at 900x560 a Tab into the contact form parked the name field
 * under the navbar pill, and at 4K the 3D page's fixed 96px reveal margin
 * sat inside the 102px pill. The browser's own reveal in the no-WebGL page
 * honours the document's `scroll-padding-top`; the 3D page's reveal scrolls
 * drei's track itself and reads the same measure.
 */
let insetTop = 0;

export function chromeInsetTop(): number {
  return insetTop;
}

/** Tracks the header's height, which is its bottom edge: it is fixed at the top of the window. */
export function observeChromeInset(header: HTMLElement): () => void {
  const root = header.ownerDocument.documentElement;
  const publish = (height: number) => {
    const next = Math.ceil(height);
    if (next === insetTop) return;
    insetTop = next;
    // Only when the height changes, at a breakpoint: a write on <html> restyles the document.
    root.style.scrollPaddingTop = `${next}px`;
  };
  publish(header.getBoundingClientRect().height);
  // Delivered after layout, so the read is already resolved.
  const observer = typeof ResizeObserver === 'undefined' ? null
    : new ResizeObserver(() => publish(header.getBoundingClientRect().height));
  observer?.observe(header);
  return () => {
    observer?.disconnect();
    insetTop = 0;
    root.style.removeProperty('scroll-padding-top');
  };
}
