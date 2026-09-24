/**
 * Keyboard focus in the 3D page.
 *
 * The sections live in drei's `Scroll html` layer: a sticky `overflow: hidden`
 * box whose content the scroll translates. The browser reveals a focused
 * offscreen control by scrolling that box, which strands the DOM thousands of
 * pixels from the scroll position and the world, and nothing scrolls it back.
 *
 * So every box between the track and `<main>` is held at zero, Tab moves focus
 * without the browser's reveal, and the page is brought to the control through
 * section navigation, which settles the chapters in between like the navbar.
 */
import { chromeInsetTop } from './chromeInset';

const TABBABLE = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'iframe',
  'audio[controls]', 'video[controls]', 'summary', '[tabindex]', '[contenteditable]:not([contenteditable="false"])',
].join(',');

/** A reveal leaves this much room between the control and the window's edge, and clears the navbar. */
const REVEAL_MARGIN_PX = 96;

function isTabbable(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled')) return false;
  if (element.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
  if (!element.getClientRects().length) return false;
  return getComputedStyle(element).visibility !== 'hidden';
}

/** Sequential focus stops in document order, as the browser would visit them. */
export function tabbableElements(root: Document = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(isTabbable);
}

/**
 * Document order, except that a `[data-focus-after]` group is visited straight
 * after the last stop inside the element its selector names, when that element
 * has any. Lets decorative hardware follow the task it serves.
 */
export function sequentialOrder(stops: HTMLElement[], root: Document = document): HTMLElement[] {
  let order = stops;
  for (const group of root.querySelectorAll<HTMLElement>('[data-focus-after]')) {
    const anchor = group.dataset.focusAfter ? root.querySelector(group.dataset.focusAfter) : null;
    const moved = order.filter(stop => group.contains(stop));
    if (!anchor || !moved.length) continue;
    const rest = order.filter(stop => !group.contains(stop));
    let last = -1;
    rest.forEach((stop, index) => { if (anchor.contains(stop)) last = index; });
    if (last < 0) continue;
    order = [...rest.slice(0, last + 1), ...moved, ...rest.slice(last + 1)];
  }
  return order;
}

/** The stop Tab (or Shift+Tab) moves to from `active`, or null at either end. */
export function sequentialNeighbour(active: HTMLElement, backward: boolean, root: Document = document,
  stops: HTMLElement[] = tabbableElements(root)): HTMLElement | null {
  stops = [...stops];
  if (!stops.includes(active)) {
    // A focused non-stop, such as a tabpanel, keeps its place in document order.
    const after = stops.findIndex(stop => Boolean(active.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING));
    stops.splice(after < 0 ? stops.length : after, 0, active);
  }
  const order = sequentialOrder(stops, root);
  return order[order.indexOf(active) + (backward ? -1 : 1)] ?? null;
}

/**
 * Whether this module reproduces the browser's order exactly. Positive
 * tabindex, radio groups (one stop per group) and shadow trees -- focus inside
 * one, or a Tab that would enter one -- follow rules it does not model, so Tab
 * is left native there; `hold` still keeps the layer aligned. Closed shadow
 * roots are invisible to the page and cannot be detected.
 */
export function reproducesNativeOrder(active: HTMLElement, stops: HTMLElement[]): boolean {
  // Focus inside a shadow tree is retargeted to its host at the document level.
  if (active.shadowRoot?.activeElement || active.getRootNode() !== active.ownerDocument) return false;
  if (stops.some(stop => stop.tabIndex > 0 || (stop instanceof HTMLInputElement && stop.type === 'radio'))) return false;
  for (const element of active.ownerDocument.querySelectorAll('*')) if (element.shadowRoot) return false;
  return true;
}

export interface LayerFocusOptions {
  /** drei's scroll track. */
  track: HTMLElement;
  main: () => HTMLElement | null;
  /** Navigates to a section with navbar intent. */
  navigate: (section: string) => void;
  /** Where the damped layer is drawn now, in track pixels; defaults to the track's target. */
  renderedScrollTop?: () => number;
}

export function installLayerFocus({ track, main, navigate, renderedScrollTop }: LayerFocusOptions): () => void {
  const root = track.ownerDocument;
  const view = root.defaultView;
  if (!view) return () => {};
  let frame = 0;

  const nudge = (element: HTMLElement) => {
    const content = main();
    if (!element.isConnected || !content) return;
    const height = track.clientHeight || view.innerHeight;
    const box = element.getBoundingClientRect();
    const margin = Math.min(REVEAL_MARGIN_PX, height * 0.12);
    const top = Math.max(margin, chromeInsetTop());
    let shift = box.bottom > height - margin ? box.bottom - (height - margin) : 0;
    if (box.top - shift < top) shift = box.top - top;
    if (Math.abs(shift) < 1) return;
    const trackRange = Math.max(track.scrollHeight - track.clientHeight, 1);
    const contentRange = Math.max(content.scrollHeight - track.clientHeight, 1);
    const from = renderedScrollTop?.() ?? track.scrollTop;
    track.scrollTop = Math.min(Math.max(from + (shift * trackRange) / contentRange, 0), trackRange);
  };

  const reveal = (element: Element | null) => {
    const content = main();
    if (!(element instanceof HTMLElement) || !content || element === content || !content.contains(element)) return;
    const height = track.clientHeight || view.innerHeight;
    const box = element.getBoundingClientRect();
    if (box.top >= chromeInsetTop() && box.bottom <= height) return;
    let section: HTMLElement = element;
    while (section.parentElement && section.parentElement !== content) section = section.parentElement;
    const area = section.getBoundingClientRect();
    view.cancelAnimationFrame(frame);
    if (section.id && (area.bottom <= 0 || area.top >= height)) {
      navigate(section.id);
      frame = view.requestAnimationFrame(() => { frame = view.requestAnimationFrame(() => nudge(element)); });
    } else nudge(element);
  };

  const hold = (event: Event) => {
    const box = event.target;
    const content = main();
    if (!(box instanceof HTMLElement) || box === track || !content || !box.contains(content)) return;
    if (!box.scrollTop && !box.scrollLeft) return;
    box.scrollTop = 0;
    box.scrollLeft = 0;
    reveal(root.activeElement);
  };

  const tab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.defaultPrevented || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    const active = root.activeElement;
    // Without a focused element the browser's starting point is unknowable; leave it the move.
    if (!(active instanceof HTMLElement) || active === root.body) return;
    const stops = tabbableElements(root);
    if (!reproducesNativeOrder(active, stops)) return;
    const next = sequentialNeighbour(active, event.shiftKey, root, stops);
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    reveal(next);
  };

  track.addEventListener('scroll', hold, { capture: true, passive: true });
  root.addEventListener('keydown', tab);
  return () => {
    track.removeEventListener('scroll', hold, { capture: true });
    root.removeEventListener('keydown', tab);
    view.cancelAnimationFrame(frame);
  };
}

/** The direct child of `content` that holds `element`: its section. */
function sectionOf(content: HTMLElement, element: Element): HTMLElement | null {
  let section: Element = element;
  while (section.parentElement && section.parentElement !== content) section = section.parentElement;
  return section.parentElement === content && section instanceof HTMLElement ? section : null;
}

/** The section under the middle of the window. */
function sectionInView(content: HTMLElement, view: Window): HTMLElement | null {
  const middle = view.innerHeight / 2;
  for (const child of content.children) {
    const box = child.getBoundingClientRect();
    if (child instanceof HTMLElement && box.top <= middle && box.bottom >= middle) return child;
  }
  return null;
}

/**
 * Keyboard focus in the no-WebGL page, which scrolls the document itself.
 *
 * The browser reveals the control, but cannot release a chapter still holding
 * the view: a Tab past About left its pinned overlay painted over everything
 * after it, and later sections never ran their entrances (round 7, D-FLAT-001).
 * Focus entering another section navigates there with navbar intent, which
 * settles the chapters in between, and then keeps the control in view.
 */
export function installDocumentFocus({ main, navigate }: {
  main: () => HTMLElement | null;
  navigate: (section: string) => void;
}): () => void {
  if (typeof document === 'undefined') return () => {};
  const root = document;
  const view = window;
  let keyboard = false;
  let from: string | null = null;
  let frame = 0;

  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    keyboard = true;
    const content = main();
    const active = root.activeElement;
    const owner = content && active instanceof HTMLElement && content.contains(active) ? sectionOf(content, active) : null;
    from = (owner ?? (content ? sectionInView(content, view) : null))?.id ?? null;
  };
  const pointer = () => { keyboard = false; };
  const follow = (event: FocusEvent) => {
    if (!keyboard) return;
    keyboard = false;
    const content = main();
    const element = event.target;
    if (!(element instanceof HTMLElement) || !content?.contains(element)) return;
    const section = sectionOf(content, element);
    if (!section?.id || section.id === from) return;
    navigate(section.id);
    view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(() => {
      frame = view.requestAnimationFrame(() => {
        if (root.activeElement === element) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  };

  root.addEventListener('keydown', key, { capture: true, passive: true });
  root.addEventListener('pointerdown', pointer, { capture: true, passive: true });
  root.addEventListener('focusin', follow, true);
  return () => {
    root.removeEventListener('keydown', key, { capture: true });
    root.removeEventListener('pointerdown', pointer, { capture: true });
    root.removeEventListener('focusin', follow, true);
    view.cancelAnimationFrame(frame);
  };
}
