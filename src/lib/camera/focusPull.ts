/**
 * How far the camera leans toward a point of interest while the world is
 * otherwise held.
 *
 * Published from the DOM layer, read per frame inside the render loop, and
 * never React state -- the same arrangement as the hold itself.
 *
 * It exists because a hold is the right behaviour for a section and the wrong
 * behaviour for a whole run of them: nothing moving for several screens stops
 * reading as composure and starts reading as a stall. This lets one section
 * inside the hold lean in and come back without the arc advancing, so the hold
 * ends on exactly the shot it started on.
 */

type Listener = (pull: number) => void;

const EPSILON = 1e-4;

let currentPull = 0;
const listeners = new Set<Listener>();

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

export function setFocusPull(next: number): void {
  const clamped = clamp01(next);
  if (Math.abs(clamped - currentPull) < EPSILON) return;
  currentPull = clamped;
  for (const listener of listeners) listener(clamped);
}

export function getFocusPull(): number {
  return currentPull;
}

export function subscribeFocusPull(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: drop every subscriber and let go. */
export function resetFocusPull(): void {
  currentPull = 0;
  listeners.clear();
}

/**
 * The lean, from how far through the section the reader is.
 *
 * Rises to a peak and returns, rather than rising and staying. A lean that
 * does not come back leaves the camera somewhere the arc never put it, so the
 * shot the hold resumes on is not the shot it paused on and the world appears
 * to have moved while it was supposedly still.
 */
export function focusCurve(progress: number, peak = 0.55): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  if (progress >= 1) return 0;
  if (!Number.isFinite(peak) || peak <= 0 || peak >= 1) return 0;

  const side = progress < peak ? progress / peak : (1 - progress) / (1 - peak);
  const amount = clamp01(side);
  return amount * amount * (3 - 2 * amount);
}
