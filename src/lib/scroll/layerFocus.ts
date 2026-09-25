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
import { chromeClearance } from './chromeInset';
import { landSectionFocus } from './sectionLanding';

const TABBABLE = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'iframe',
  'audio[controls]', 'video[controls]', 'summary', '[tabindex]', '[contenteditable]:not([contenteditable="false"])',
].join(',');

/** A reveal leaves this much room between the control and the window's edge, and clears the navbar. */
const REVEAL_MARGIN_PX = 96;
/** Room a stop keeps from the edge of the box it scrolls in, for its focus ring. */
const OWN_BOX_MARGIN_PX = 8;

/** What a reveal has to show: the control, and for a field the labels that name it. */
export function revealBox(element: HTMLElement): { top: number; bottom: number } {
  const box = element.getBoundingClientRect();
  let { top, bottom } = box;
  const labels = (element as Partial<HTMLInputElement>).labels;
  for (const label of labels ?? []) {
    const named = label.getBoundingClientRect();
    top = Math.min(top, named.top);
    bottom = Math.max(bottom, named.bottom);
  }
  return { top, bottom };
}

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
    const box = revealBox(element);
    const margin = Math.min(REVEAL_MARGIN_PX, height * 0.12);
    const top = Math.max(margin, chromeClearance());
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
    const box = revealBox(element);
    if (box.top >= chromeClearance() && box.bottom <= height) return;
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
    const content = main();
    const entry = content ? tabDetour(content, active, next, event.shiftKey, view) : null;
    if (entry) {
      event.preventDefault();
      navigate(entry);
      landSectionFocus(entry, root);
      return;
    }
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    if (content?.contains(next)) reveal(next);
    else revealInOwnBox(next, view);
  };

  /*
   * Native validation focuses the first invalid field and scrolls it into
   * view, but the browser's view is the viewport, not what the navbar leaves
   * of it: at 900x560 a blank Send put Name half under the bar, its message
   * bubble over the navigation (round 8, D-A11Y-002). The field it focuses is
   * revealed the way keyboard focus is, clear of the bar.
   */
  const invalid = (event: Event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement)) return;
    view.requestAnimationFrame(() => { if (root.activeElement === field) reveal(field); });
  };

  track.addEventListener('scroll', hold, { capture: true, passive: true });
  root.addEventListener('keydown', tab);
  root.addEventListener('invalid', invalid, true);
  return () => {
    track.removeEventListener('scroll', hold, { capture: true });
    root.removeEventListener('keydown', tab);
    root.removeEventListener('invalid', invalid, true);
    view.cancelAnimationFrame(frame);
  };
}

/**
 * Scrolls the box a portalled stop scrolls in, so the stop shows. Tab moves
 * focus without the browser's reveal, which would scroll drei's transformed
 * layer, so a link below the TV copy's fold took focus out of sight (round 9,
 * TECH-020). The TV's reader is drawn through a projection: its drawn pixels
 * are converted to the box's own before scrolling.
 */
function revealInOwnBox(element: HTMLElement, view: Window): void {
  for (let box = element.parentElement; box && box !== element.ownerDocument.body; box = box.parentElement) {
    if (box.scrollHeight <= box.clientHeight + 1 || !/auto|scroll|overlay/.test(view.getComputedStyle(box).overflowY)) continue;
    const outer = box.getBoundingClientRect();
    const inner = element.getBoundingClientRect();
    const scale = box.clientHeight > 0 && outer.height > 0 ? outer.height / box.clientHeight : 1;
    const margin = OWN_BOX_MARGIN_PX * scale;
    let shift = inner.bottom > outer.bottom - margin ? inner.bottom - (outer.bottom - margin) : 0;
    if (inner.top - shift < outer.top + margin) shift = inner.top - (outer.top + margin);
    if (Math.abs(shift) >= 1) box.scrollTop += shift / scale;
    return;
  }
}

/** The direct child of `content` that holds `element`: its section. */
function sectionOf(content: HTMLElement, element: Element): HTMLElement | null {
  let section: Element = element;
  while (section.parentElement && section.parentElement !== content) section = section.parentElement;
  return section.parentElement === content && section instanceof HTMLElement ? section : null;
}

/**
 * Which chapter a stop belongs to, as an index into the story: its own
 * section, or the section named by the `data-section-owner` of the portalled
 * reader that holds it (Skills, Education and the TV are portalled to the
 * body, so document order does not place them). -1 for chrome.
 */
function chapterIndex(content: HTMLElement, sections: Element[], element: Element): number {
  const section = sectionOf(content, element);
  if (section) return sections.indexOf(section);
  const owner = element.closest<HTMLElement>('[data-section-owner]')?.dataset.sectionOwner;
  const reader = owner ? content.ownerDocument.getElementById(owner) : null;
  return reader?.parentElement === content ? sections.indexOf(reader) : -1;
}

/**
 * The chapter whose portalled reader holds the view, or -1. The story is
 * inert exactly while one does (Skills, the TV); the reader is the one live
 * owner of a section.
 */
function pinnedChapter(content: HTMLElement, sections: Element[]): number {
  if (!content.closest('[inert]')) return -1;
  for (const owner of content.ownerDocument.querySelectorAll('[data-section-owner]')) {
    if (owner.closest('[inert], [aria-hidden="true"], [hidden]')) continue;
    const index = chapterIndex(content, sections, owner);
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * A chapter's entry, when Tab cannot reach its controls where they are: its
 * reader is portalled out of the story's order (Skills, the TV), or the
 * story itself is inert because another chapter holds the view. Chapters
 * with controls mark their landing `data-tab-entry`; those without (About's
 * statements) are passed over, as Tab passes over text.
 */
function unreachableEntry(content: HTMLElement, section: Element): boolean {
  if (!section.id) return false;
  const entry = content.ownerDocument.querySelector(`[data-tab-entry][data-section-landing="${section.id}"]`);
  return Boolean(entry) && (!section.contains(entry) || Boolean(section.closest('[inert]')));
}

/**
 * The chapter a Tab should visit before `to`, the stop the browser would move
 * to (null past either end of the document).
 *
 * Document order skipped whole chapters: the staged TV reader is inert until
 * the TV is on screen, so Tab went from Home straight to Contact and Projects
 * was never visited (round 7, D-A11Y-001); and a portalled reader's last stop
 * was the end of the document, so Tab left Skills and the TV for the browser's
 * own chrome instead of continuing the story. A Tab that passes over a chapter
 * whose entry is unreachable, or that runs off the end of a reader with the
 * story unfinished, visits that chapter by navigating there, forward and back.
 *
 * The story position is the reader's, not the focused control's: focus left on
 * Home while the wheel carried the reader to Contact must not send the next
 * Tab back through the chapters already read. While a pinned reader holds the
 * view, though, the native track runs on beneath it, and the chapter on
 * screen is the reader's own (round 9, TECH-019).
 */
function tabDetour(content: HTMLElement, from: HTMLElement, to: HTMLElement | null, backward: boolean,
  view: Window): string | null {
  const sections = [...content.children];
  const own = chapterIndex(content, sections, from);
  const pinned = pinnedChapter(content, sections);
  let start: number;
  if (pinned >= 0) start = own >= 0 ? own : pinned;
  else {
    const inView = sectionInView(content, view);
    const viewed = inView ? sections.indexOf(inView) : -1;
    start = own < 0 ? viewed : viewed < 0 ? own : backward ? Math.min(own, viewed) : Math.max(own, viewed);
  }
  if (start < 0) return null;
  let end: number;
  if (to) {
    end = chapterIndex(content, sections, to);
    if (end < 0) end = content.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_PRECEDING ? -1 : sections.length;
  } else {
    // Off the end of the document: only a chapter's own reader continues into the story.
    if (own < 0) return null;
    end = backward ? -1 : sections.length;
  }
  // Only a move that travels through the story in its own direction passes anything.
  if (backward ? end >= start : end <= start) return null;
  const passed = backward ? sections.slice(end + 1, start).reverse() : sections.slice(start + 1, end);
  return passed.find(section => unreachableEntry(content, section))?.id ?? null;
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

  // Native validation aligns the field under the bar; its label, above it, is shown with it.
  const invalid = (event: Event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !main()?.contains(field)) return;
    view.requestAnimationFrame(() => {
      if (root.activeElement !== field) return;
      const hidden = chromeClearance() - revealBox(field).top;
      if (hidden >= 1) view.scrollBy({ top: -hidden, behavior: 'auto' });
    });
  };

  root.addEventListener('keydown', key, { capture: true, passive: true });
  root.addEventListener('pointerdown', pointer, { capture: true, passive: true });
  root.addEventListener('focusin', follow, true);
  root.addEventListener('invalid', invalid, true);
  return () => {
    root.removeEventListener('keydown', key, { capture: true });
    root.removeEventListener('pointerdown', pointer, { capture: true });
    root.removeEventListener('focusin', follow, true);
    root.removeEventListener('invalid', invalid, true);
    view.cancelAnimationFrame(frame);
  };
}
