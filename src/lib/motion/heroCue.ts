/**
 * How far the hero's handover cue has been drawn, shared by the few things
 * that need it.
 *
 * Home measures it -- one bounding rect per frame, which is what a pin costs --
 * and writes the results it owns straight to the DOM. The scroll cue is the
 * one part that genuinely needs a render per step, because it is an SVG path
 * being traced, so it subscribes here rather than making Home re-render the
 * whole hero sixty times a second to move a dash.
 *
 * A plain module value, like the scroll and camera stores beside it: read from
 * a frame callback, and it must never cause a re-render of the section that
 * publishes it.
 */

type Listener = (progress: number) => void;

/** Below this a publish is dropped, so a slow scroll does not churn. */
const EPSILON = 1e-4;

let current = 0;
const listeners = new Set<Listener>();

export function setHeroCue(progress: number): void {
  const next = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  if (Math.abs(next - current) < EPSILON) return;
  current = next;
  for (const listener of listeners) listener(next);
}

export function getHeroCue(): number {
  return current;
}

export function subscribeHeroCue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: drop every subscriber and rewind. */
export function resetHeroCue(): void {
  current = 0;
  listeners.clear();
}
