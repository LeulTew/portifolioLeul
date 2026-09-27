/* ============================================================================
   The reader asking for the next thing.

   The About section is a chain of discrete beats: the statements clear, then
   the background rises, then the heading is rewritten. Each one is its own
   event, and the reader is supposed to ask for each one.

   Position cannot express that. A beat's threshold is crossed once, and by the
   time the beat before it has finished playing -- on a clock, over a second and
   a half -- the reader is usually long past every remaining threshold. Gating
   only on position and on the previous beat's completion means the whole chain
   fires itself off a single flick: the wall lands and the heading is already
   dissolving, with no input in between.

   So a beat also waits for a gesture. This module is where a gesture comes
   from, and it does exactly one thing: it reports them.

   WHAT THIS DOES NOT DO, AND MUST NEVER DO
   ----------------------------------------
   It does not call `preventDefault`. It does not call `stopPropagation` or
   `stopImmediatePropagation`. It does not decide whether the page may scroll.
   Every listener here is registered `passive: true`, which makes cancelling
   impossible rather than merely discouraged -- the browser will warn and ignore
   any attempt.

   That is not a style preference. The predecessor of this file absorbed wheel
   events whenever an animation was registered as running, and a beat that
   flip-flopped its own trigger every frame therefore cancelled input on roughly
   every other frame: the reader was pinned in About with the page refusing to
   move. Arming a beat and blocking the scroll are completely different things,
   and only the first one is wanted here.

   A gesture is an intention, never a permission.
   ========================================================================== */

import { scrollKeyIntent, type ScrollDirection } from './scrollKeys';

export type { ScrollDirection } from './scrollKeys';

type Listener = (direction: ScrollDirection) => void;

interface GestureOptions {
  startsOnly?: boolean;
  ignoreTarget?: (target: EventTarget | null) => boolean;
}

const listeners = new Map<Listener, GestureOptions>();
let started = false;
let lastWheelAt = -Infinity;
let wheelStarted = false;
let touchStarted = false;

/** Momentum stays in one wave until the wheel has been quiet for this long. */
export const SCROLL_WAVE_IDLE_MS = 250;

/** Wheel deltas below this are trackpad settling, not a request for anything. */
const WHEEL_THRESHOLD = 2;

/** Touch travel below this is a tap wobble. */
const TOUCH_THRESHOLD = 6;

function emit(direction: ScrollDirection, waveStart: boolean, target: EventTarget | null): void {
  for (const [listener, options] of listeners) {
    if (options.ignoreTarget?.(target)) continue;
    if (!options.startsOnly || waveStart) listener(direction);
  }
}

function onWheel(event: WheelEvent): void {
  const now = performance.now();
  if (now - lastWheelAt >= SCROLL_WAVE_IDLE_MS) wheelStarted = false;
  lastWheelAt = now;
  if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
  emit(event.deltaY > 0 ? 'down' : 'up', !wheelStarted, event.target);
  wheelStarted = true;
}

let touchY: number | null = null;

function onTouchStart(event: TouchEvent): void {
  touchY = event.touches[0]?.clientY ?? null;
  touchStarted = false;
}

function onTouchMove(event: TouchEvent): void {
  const current = event.touches[0]?.clientY;
  if (current === undefined || touchY === null) return;
  const travelled = touchY - current;
  if (Math.abs(travelled) < TOUCH_THRESHOLD) return;
  touchY = current;
  emit(travelled > 0 ? 'down' : 'up', !touchStarted, event.target);
  touchStarted = true;
}

function onTouchEnd(): void {
  touchY = null;
  touchStarted = false;
}

function onKeyDown(event: KeyboardEvent): void {
  // The same reading of the key the physical scroll uses: see scrollKeys.
  const intent = scrollKeyIntent(event);
  // Home and End navigate to the story's first or last chapter (storyKeys); they ask no beat for more.
  if (intent && intent.extent !== 'document') emit(intent.direction, !event.repeat, event.target);
}

/*
 * A drag of a scrollbar is the reader travelling, as a wheel is -- and reported
 * like one, one wave from press to release. Without it the scrollbar moved the
 * page past every chapter that waits for a gesture: dragged back from Contact,
 * Projects rested empty; from an active Skills or TV reader the chapter never
 * began to leave (round 22, D-MOTION-006; round 23, D-MOTION-007). Only the
 * travel of the scroller whose own scrollbar was pressed counts, and only while
 * the press lasts: a scroll the page makes for itself is never the reader's.
 */
interface ScrollbarDrag {
  scroller: Element;
  target: EventTarget | null;
  /** Where the thumb last put the page. */
  last: number;
  started: boolean;
}
let drag: ScrollbarDrag | null = null;

/** Drag travel below this is the thumb settling under the pointer. */
const DRAG_THRESHOLD = 4;

/** The page's own scroll writes held back while a thumb is held, in order. */
const heldWrites: { write: () => void; key?: unknown }[] = [];
/** A runaway producer is not given an unbounded queue; the latest writes are kept. */
const HELD_WRITES_MAX = 32;
const pressListeners = new Set<() => void>();

export interface OwnScrollOptions {
  /**
   * What the write is for. A held write is replaced by a newer one for the same
   * purpose, so only the latest intent runs on release: a glide's frames, a
   * focus reveal, a resize anchor's settle each measure where they stand when
   * they finally run, never against a page that has not moved yet (round 27,
   * TECH-075/076/077).
   */
  key?: unknown;
}

/**
 * Runs a scroll the page makes for itself -- a restore, a settle, a glide, a
 * forwarded wheel, a focus reveal -- so that it is never taken for the reader's
 * travel. Held still under an engaged TV, a forwarded scroll of 160px read as a
 * request and the TV began to retreat (round 24, TECH-068).
 *
 * While a scrollbar thumb is held, the write waits for its release. The browser
 * does not let a write stand under a held thumb: it puts the page back under
 * the thumb, at places neither the thumb nor the page chose, and every attempt
 * to tell those returns from the reader's own travel from the positions alone
 * either invented requests or reversed and lost real ones -- Chrome sends the
 * page no pointer movement during a thumb drag to tell them apart by (round 25,
 * TECH-069/070; round 26, TECH-072/073). With nothing written under the thumb,
 * every movement of the page while it is held is the reader's. The held writes
 * run, in order, when the thumb is let go; a write that works out where to go
 * from the page's geometry does so inside `write`, so it measures then.
 */
export function ownScroll(write: () => void, { key }: OwnScrollOptions = {}): void {
  if (!drag) {
    write();
    return;
  }
  if (key !== undefined) {
    const index = heldWrites.findIndex(held => held.key === key);
    if (index >= 0) heldWrites.splice(index, 1);
  }
  heldWrites.push({ write, key });
  if (heldWrites.length > HELD_WRITES_MAX) heldWrites.splice(0, heldWrites.length - HELD_WRITES_MAX);
}

/** Drops a held write that is no longer wanted, such as a cancelled glide's frame. */
export function forgetHeldScroll(key: unknown): void {
  const index = heldWrites.findIndex(held => held.key === key);
  if (index >= 0) heldWrites.splice(index, 1);
}

/** Whether a scrollbar thumb is held now, so a write would wait for its release. */
export function isScrollHeld(): boolean {
  return drag !== null;
}

/**
 * Hears a press on a scrollbar, the reader taking the page in hand: whatever
 * the page was moving for itself stops where it is (round 26, TECH-073).
 */
export function subscribeScrollbarPress(listener: () => void): () => void {
  pressListeners.add(listener);
  initScrollGesture();
  return () => {
    pressListeners.delete(listener);
    if (listeners.size === 0 && pressListeners.size === 0) cleanupScrollGesture();
  };
}

function scrollbarUnder(event: PointerEvent): Element | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const root = document.documentElement;
  if (target === root || target === document.body) {
    const page = document.scrollingElement;
    return page && event.clientX >= root.clientWidth && page.scrollHeight > page.clientHeight ? page : null;
  }
  if (target.scrollHeight <= target.clientHeight) return null;
  const box = target.getBoundingClientRect();
  return event.clientX - box.left - target.clientLeft >= target.clientWidth ? target : null;
}

function onPointerDown(event: PointerEvent): void {
  endDrag();
  if (event.button !== 0) return;
  const scroller = scrollbarUnder(event);
  if (!scroller) return;
  drag = { scroller, target: event.target, last: scroller.scrollTop, started: false };
  pressListeners.forEach(listener => listener());
}

function onPointerMove(event: PointerEvent): void {
  // A release the page never heard ends the drag at the next move without a button held.
  if (drag && event.buttons === 0) endDrag();
}

function endDrag(): void {
  if (!drag) return;
  drag = null;
  const writes = heldWrites.splice(0);
  for (const { write } of writes) write();
}

/**
 * The reader's own input while a thumb is held: whatever the page had queued to
 * do on release was asked for before it, and the reader has since said what
 * they want. Heard in the capture phase, so it retires only what came earlier;
 * a key's own consequence, queued by the handlers that answer it, still stands.
 * One rule for every producer, rather than each remembering to cancel: an End
 * landing, a cross-chapter Tab reveal and a portalled reader's reveal had each
 * run over the reader's later travel (round 29, TECH-081/082).
 */
function retireHeldWrites(): void {
  if (drag) heldWrites.length = 0;
}

function onReaderKey(event: KeyboardEvent): void {
  if (event.key === 'Tab' || scrollKeyIntent(event)) retireHeldWrites();
}

function onScroll(event: Event): void {
  if (!drag) return;
  const source = event.target === document ? document.scrollingElement : event.target;
  if (source !== drag.scroller) return;
  const top = drag.scroller.scrollTop;
  const travelled = top - drag.last;
  if (Math.abs(travelled) < DRAG_THRESHOLD) return;
  drag.last = top;
  // The thumb moving is the reader's travel: nothing asked for before it still stands.
  heldWrites.length = 0;
  emit(travelled > 0 ? 'down' : 'up', !drag.started, drag.target);
  drag.started = true;
}
/** Starts listening. Safe to call more than once. */
export function initScrollGesture(): () => void {
  if (typeof window === 'undefined' || started) return () => {};
  started = true;

  // Every one of these is passive. See the note at the top of the file.
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKeyDown, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  window.addEventListener('pointerup', endDrag, { capture: true, passive: true });
  window.addEventListener('pointercancel', endDrag, { capture: true, passive: true });
  window.addEventListener('blur', endDrag, { passive: true });
  // Capture hears every scroller's own scroll, as well as the document's.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  // The reader's own input while a thumb is held retires what the page queued before it.
  window.addEventListener('wheel', retireHeldWrites, { capture: true, passive: true });
  window.addEventListener('touchstart', retireHeldWrites, { capture: true, passive: true });
  window.addEventListener('keydown', onReaderKey, { capture: true, passive: true });

  return cleanupScrollGesture;
}

function cleanupScrollGesture(): void {
  if (typeof window === 'undefined' || !started) return;
  started = false;
  window.removeEventListener('wheel', onWheel);
  window.removeEventListener('touchstart', onTouchStart);
  window.removeEventListener('touchmove', onTouchMove);
  window.removeEventListener('touchend', onTouchEnd);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('pointerdown', onPointerDown, { capture: true });
  window.removeEventListener('pointermove', onPointerMove, { capture: true });
  window.removeEventListener('pointerup', endDrag, { capture: true });
  window.removeEventListener('pointercancel', endDrag, { capture: true });
  window.removeEventListener('blur', endDrag);
  window.removeEventListener('scroll', onScroll, { capture: true });
  window.removeEventListener('wheel', retireHeldWrites, { capture: true });
  window.removeEventListener('touchstart', retireHeldWrites, { capture: true });
  window.removeEventListener('keydown', onReaderKey, { capture: true });
  // Nothing written for the page is lost with the listeners.
  endDrag();
  touchY = null;
  touchStarted = false;
  lastWheelAt = -Infinity;
  wheelStarted = false;
}

export function subscribeScrollGesture(
  listener: Listener,
  options: GestureOptions = {}
): () => void {
  listeners.set(listener, options);
  // Listening is what starts it, so nothing has to remember to initialise it.
  initScrollGesture();
  return () => {
    listeners.delete(listener);
    // Nothing is asking any more, so stop listening. Otherwise a section that
    // unmounts leaves its window listeners running for the life of the page.
    if (listeners.size === 0 && pressListeners.size === 0) cleanupScrollGesture();
  };
}

/** Test helper: drops every listener and stops the window listeners. */
export function resetScrollGesture(): void {
  listeners.clear();
  pressListeners.clear();
  cleanupScrollGesture();
}
