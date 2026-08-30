import { NO_HOLD, type ArcHold } from './holdRange';

/**
 * The currently measured hold, shared between the DOM layer that measures it
 * and the render loop that obeys it.
 *
 * A plain module value rather than React state: it is read every frame inside
 * useFrame and must never trigger a re-render of the 3D tree.
 */

let currentHold: ArcHold = NO_HOLD;

export function setCameraHold(hold: ArcHold): void {
  currentHold = hold;
}

export function getCameraHold(): ArcHold {
  return currentHold;
}

/** Test-only: forget any measured hold. */
export function resetCameraHold(): void {
  currentHold = NO_HOLD;
}
