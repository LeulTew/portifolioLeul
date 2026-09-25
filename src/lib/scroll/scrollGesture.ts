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
    // unmounts leaves five window listeners running for the life of the page.
    if (listeners.size === 0) cleanupScrollGesture();
  };
}

/** Test helper: drops every listener and stops the window listeners. */
export function resetScrollGesture(): void {
  listeners.clear();
  cleanupScrollGesture();
}
