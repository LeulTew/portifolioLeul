/**
 * An element looked up once and remembered until it leaves the document.
 *
 * The page publishes scroll progress from inside the R3F render loop, so every
 * subscriber's work runs synchronously on every frame. Several of them were
 * re-finding the same handful of nodes each time, and some of those lookups
 * were `document.querySelector` calls with attribute-substring matchers --
 * `[data-testid*="sequence-overlay"]`, `[style*="--seq"]`, `[class*="heldGround"]`
 * -- which cannot use any index and so walk every element in the document. Run
 * per frame, per subscriber, that is a measurable share of the frame spent
 * finding nodes that had not moved.
 *
 * `isConnected` is the re-resolve trigger rather than a timer: the nodes here
 * are portalled and remounted, so identity can genuinely change, but only when
 * the old one has been detached.
 */
export function cachedElement<T extends Element>(lookup: () => T | null): () => T | null {
  let cached: T | null = null;

  return () => {
    if (cached && cached.isConnected) return cached;
    cached = lookup();
    return cached;
  };
}

/**
 * Sets an attribute only when it would change it.
 *
 * `setAttribute` invalidates style for the element's subtree whether or not the
 * value differs. On `documentElement` that is the whole page, and this was
 * being written on every frame.
 */
export function writeAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
    return;
  }
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}
