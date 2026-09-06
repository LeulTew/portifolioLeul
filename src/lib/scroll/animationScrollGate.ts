/**
 * Global Animation Scroll Gate and Stage Coordinator.
 *
 * Enforces the core interaction design contract:
 * 1. An animation runs at its fixed duration (fixed speed).
 * 2. Rapid or aggressive scrolling cannot rush, skip, or prematurely trigger
 *    subsequent animations while an animation is actively playing.
 * 3. Discrete stages (e.g. About Background change -> Title change -> Education)
 *    require distinct, separate scroll gestures rather than cascading from one scroll.
 */

type BusyListener = (busy: boolean) => void;
type ScrollIntentListener = (direction: 'down' | 'up', event?: Event) => void;

const activeAnimations = new Set<string>();
const busyListeners = new Set<BusyListener>();
const intentListeners = new Set<ScrollIntentListener>();
const animationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

let programmaticNav = false;
let isInitialized = false;

const SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Space',
  'Home',
  'End',
]);

/** Returns true if any registered time-based animation is currently active. */
export function isAnimationBusy(): boolean {
  return activeAnimations.size > 0;
}

/**
 * Registers an active animation by ID.
 * Returns an unregister function to call when the animation completes or unmounts.
 * Includes a safety watchdog timer so an animation can never lock scroll indefinitely.
 */
export function startAnimation(id: string, maxDurationMs: number = 2500): () => void {
  const wasBusy = activeAnimations.size > 0;
  activeAnimations.add(id);

  if (animationTimeouts.has(id)) {
    clearTimeout(animationTimeouts.get(id)!);
  }

  // Safety watchdog: auto-release if animation fails to finish within expected duration + buffer
  const timer = setTimeout(() => {
    endAnimation(id);
  }, maxDurationMs + 500);
  animationTimeouts.set(id, timer);

  if (!wasBusy) {
    notifyBusy(true);
  }

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    endAnimation(id);
  };
}

/** Explicitly ends an animation by ID. */
export function endAnimation(id: string): void {
  if (animationTimeouts.has(id)) {
    clearTimeout(animationTimeouts.get(id)!);
    animationTimeouts.delete(id);
  }
  if (activeAnimations.delete(id)) {
    if (activeAnimations.size === 0) {
      notifyBusy(false);
    }
  }
}

function notifyBusy(busy: boolean): void {
  for (const listener of busyListeners) {
    listener(busy);
  }
}

export function subscribeAnimationBusy(listener: BusyListener): () => void {
  busyListeners.add(listener);
  return () => {
    busyListeners.delete(listener);
  };
}

/** Emits a scroll intent event whenever the user initiates a scroll action. */
export function emitScrollIntent(direction: 'down' | 'up', event?: Event): void {
  for (const listener of intentListeners) {
    listener(direction, event);
  }
}

export function subscribeScrollIntent(listener: ScrollIntentListener): () => void {
  intentListeners.add(listener);
  return () => {
    intentListeners.delete(listener);
  };
}

/** Programmatic navigation bypass flag (e.g. clicking top nav links). */
export function setProgrammaticNavigation(navigating: boolean): void {
  programmaticNav = navigating;
}

export function isProgrammaticNavigation(): boolean {
  return programmaticNav;
}

/** Handles wheel events on capture phase. */
function handleWheel(e: WheelEvent): void {
  if (programmaticNav) return;

  const direction: 'down' | 'up' = e.deltaY > 0 ? 'down' : 'up';

  // Always emit scroll intent (with current busy status)
  emitScrollIntent(direction, e);

  // If an animation is busy, absorb the wheel input completely so it cannot advance scroll
  if (isAnimationBusy()) {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopImmediatePropagation();
  }
}

let touchStartY = 0;

function handleTouchStart(e: TouchEvent): void {
  if (e.touches[0]) {
    touchStartY = e.touches[0].clientY;
  }
}

function handleTouchMove(e: TouchEvent): void {
  if (programmaticNav) return;
  if (!e.touches[0]) return;

  const currentY = e.touches[0].clientY;
  const deltaY = touchStartY - currentY;
  if (Math.abs(deltaY) < 4) return;

  const direction: 'down' | 'up' = deltaY > 0 ? 'down' : 'up';
  emitScrollIntent(direction, e);

  if (isAnimationBusy()) {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopImmediatePropagation();
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  if (programmaticNav) return;
  if (!SCROLL_KEYS.has(e.key)) return;

  const direction: 'down' | 'up' =
    e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'Space' ? 'down' : 'up';

  emitScrollIntent(direction, e);

  if (isAnimationBusy()) {
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopImmediatePropagation();
  }
}

/** Initializes the capture-phase input listeners on the window. */
export function initAnimationScrollGate(): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }

  isInitialized = true;
  window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
  window.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
  window.addEventListener('keydown', handleKeyDown, { passive: false, capture: true });

  return () => {
    cleanupAnimationScrollGate();
  };
}

/** Cleans up input listeners. */
export function cleanupAnimationScrollGate(): void {
  if (typeof window === 'undefined' || !isInitialized) return;
  isInitialized = false;
  window.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
  window.removeEventListener('touchstart', handleTouchStart, { capture: true } as EventListenerOptions);
  window.removeEventListener('touchmove', handleTouchMove, { capture: true } as EventListenerOptions);
  window.removeEventListener('keydown', handleKeyDown, { capture: true } as EventListenerOptions);
}

/** Test utility to reset all gate state. */
export function resetAnimationScrollGate(): void {
  for (const timer of animationTimeouts.values()) {
    clearTimeout(timer);
  }
  animationTimeouts.clear();
  activeAnimations.clear();
  busyListeners.clear();
  intentListeners.clear();
  programmaticNav = false;
}
