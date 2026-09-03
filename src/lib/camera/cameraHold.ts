import { NO_HOLD, NO_HOLDS, type ArcHold, type ArcHolds } from './holdRange';

/**
 * The measured holds, shared between the DOM layer that measures them and the
 * render loop that obeys them.
 *
 * Plain module values rather than React state: they are read every frame
 * inside useFrame and must never trigger a re-render of the 3D tree.
 *
 * Two of them, because one value was doing two jobs that only happened to
 * coincide. Freezing the camera and skipping the draw are the same thing for
 * an opaque section -- there is nothing to see, so nothing needs drawing or
 * moving. They are opposites for the hero, which holds the reader still with
 * the world in full view: the camera must stop, and the world must keep being
 * drawn. Sharing one range meant giving the hero a hold would have stopped
 * rendering the very thing it is holding still to show.
 */

/** Spans during which the camera does not advance. Hero and About. */
let freezes: ArcHolds = NO_HOLDS;

/** The span during which nothing is drawn at all. About only. */
let occlusion: ArcHold = NO_HOLD;

export function setCameraFreezes(next: ArcHolds): void {
  freezes = next;
}

export function getCameraFreezes(): ArcHolds {
  return freezes;
}

export function setWorldOcclusion(next: ArcHold): void {
  occlusion = next;
}

export function getWorldOcclusion(): ArcHold {
  return occlusion;
}

/** Test-only: forget every measured hold. */
export function resetCameraHold(): void {
  freezes = NO_HOLDS;
  occlusion = NO_HOLD;
}
