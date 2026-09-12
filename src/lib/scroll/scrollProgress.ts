import { useCallback, useSyncExternalStore } from 'react';

/**
 * Single source of truth for normalized page scroll progress [0..1].
 *
 * The page scrolls inside drei's `ScrollControls` element, not the window, so
 * `window.scrollY` and `document.documentElement.scrollHeight` are always 0 /
 * viewport-sized here. Anything outside the R3F render loop that needs to react
 * to scroll (focus scrims, section state, camera chapter readouts) subscribes
 * to this store instead, which is published once per frame from inside the
 * Canvas.
 */

type Listener = (progress: number) => void;

/** Below this delta a publish is dropped, so we don't re-render on jitter. */
const EPSILON = 1e-4;

let currentProgress = 0;
const listeners = new Set<Listener>();
const measurements = new Set<Listener>();

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Geometry repairs need a fresh measurement even when progress is unchanged. */
export function setScrollProgress(next: number, geometryChanged = false): void {
  const clamped = clamp01(next);
  if (!geometryChanged && Math.abs(clamped - currentProgress) < EPSILON) return;
  currentProgress = clamped;
  for (const measure of measurements) measure(clamped);
  for (const listener of listeners) listener(clamped);
}

export function getScrollProgress(): number {
  return currentProgress;
}

/** Local sequence geometry must be published before its animation consumers. */
export function subscribeScrollProgress(
  listener: Listener,
  phase: 'measure' | 'consume' = 'consume'
): () => void {
  const subscribers = phase === 'measure' ? measurements : listeners;
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/** Test-only escape hatch: drop every subscriber and rewind to the top. */
export function resetScrollProgress(): void {
  currentProgress = 0;
  listeners.clear();
  measurements.clear();
}

/** Re-renders the calling component whenever page scroll progress changes. */
export function useScrollProgress(): number {
  return useSyncExternalStore(subscribeScrollProgress, getScrollProgress, getScrollProgress);
}

/**
 * True while progress sits inside `[start, end]`. Re-renders only when the
 * boolean flips, not on every frame, which keeps DOM sections off the hot path.
 */
export function useScrollRange(start: number, end: number): boolean {
  const getSnapshot = useCallback(
    () => currentProgress >= start && currentProgress <= end,
    [start, end]
  );

  const subscribe = useCallback((onStoreChange: () => void) => {
    return subscribeScrollProgress(() => onStoreChange());
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
