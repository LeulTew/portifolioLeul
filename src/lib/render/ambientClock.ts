/**
 * The clock the scene's ambient life runs on, which stops while the world is
 * held still.
 *
 * A camera freeze pins the viewpoint, and that turned out not to be enough. The
 * sky is a star field rotating off the elapsed clock and the motes drift and
 * spin off it too, so across a hold -- the one stretch where the reader is
 * being asked to look at something else while the world waits -- the only
 * things moving were a rotating sky and drifting dust. A held scene with a
 * turning sky does not read as held; it reads as the background rotating,
 * which is exactly what the hold exists to prevent.
 *
 * So ambient time stops advancing while frozen and resumes from where it
 * stopped, with the frozen span discounted. There is no jump on either edge:
 * the sky is where it was, and starts turning again from there.
 *
 * The ocean deliberately does NOT read this. Surf breaking on the island is
 * the scene's subject rather than its ambience, and a sea frozen mid-break
 * reads as a broken render, not as a held beat.
 *
 * One decision per frame, like the frame gate beside it: every caller within a
 * frame gets the same answer, so the star field and the drift cannot disagree
 * about what time it is.
 */

import { getScrollProgress } from '@/lib/scroll/scrollProgress';
import { getCameraFreezes } from '@/lib/camera/cameraHold';
import { isCameraFrozen } from '@/lib/camera/holdRange';

let lastElapsed = Number.NEGATIVE_INFINITY;
let lastValue = 0;

/** Elapsed time at which the current freeze began, or null when running. */
let freezeStart: number | null = null;

/** Total elapsed time spent frozen, discounted from every later answer. */
let discarded = 0;

/**
 * Ambient time for `elapsed`, frozen while the camera is.
 *
 * Repeated calls within a frame return the same value rather than re-deciding,
 * so nothing advances the freeze bookkeeping more than once per frame.
 */
export function ambientTime(elapsed: number): number {
  if (!Number.isFinite(elapsed)) return lastValue;
  if (elapsed === lastElapsed) return lastValue;

  // A clock that restarted is a new sequence, not time travelling backwards.
  if (elapsed < lastElapsed) {
    freezeStart = null;
    discarded = 0;
  }

  const frozen = isCameraFrozen(getScrollProgress(), getCameraFreezes());

  if (frozen) {
    if (freezeStart === null) freezeStart = elapsed;
  } else if (freezeStart !== null) {
    /*
     * Charged to the last frame that was actually frozen, not to this one.
     * The freeze ended somewhere between the two, and billing the whole gap
     * to it would swallow a frame of live time on every release.
     */
    const heldUntil = Number.isFinite(lastElapsed) ? lastElapsed : freezeStart;
    discarded += Math.max(heldUntil - freezeStart, 0);
    freezeStart = null;
  }

  lastElapsed = elapsed;
  lastValue = (freezeStart ?? elapsed) - discarded;
  return lastValue;
}

/** Test-only: forget every freeze and rewind. */
export function resetAmbientClock(): void {
  lastElapsed = Number.NEGATIVE_INFINITY;
  lastValue = 0;
  freezeStart = null;
  discarded = 0;
}
