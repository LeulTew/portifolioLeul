/* ============================================================================
   A beat that scroll starts and time finishes.

   The hero handover used to read its position straight out of the scroll
   offset. That is a scrub, and a scrub inherits every irregularity of the hand
   driving it: a wheel notch is a discrete jump of around a hundred pixels,
   trackpad momentum arrives in uneven deltas, and a dropped frame lands as a
   visible step rather than as a slightly late one. No amount of easing fixes
   that, because the easing is applied to an input that is itself lumpy -- the
   animation can never be smoother than the scroll.

   Here scroll decides only *whether* a beat should be running. The position
   comes from elapsed time, so one notch past the threshold buys the whole
   eased movement at whatever rate the display can paint. Scrolling harder does
   not fast-forward it, and stopping halfway does not leave it frozen
   half-open. That is the difference between "the page moves when I move" and
   "I scroll, and then something happens".

   The beats stay reversible, because the reader can always scroll back up. A
   beat interrupted at 40% runs back down from 40% rather than snapping to
   either end, which is the one thing a naive play-on-trigger gets wrong.
   ========================================================================== */

/** Where a beat currently stands. */
export interface PhaseState {
  /**
   * Linear position through the beat: 0 at rest, 1 finished.
   *
   * Deliberately linear. Curves are applied when the value is read, so that
   * reversing from the middle re-treads the same curve backwards instead of
   * easing out of an already-eased number.
   */
  readonly t: number;
  /** Whether it is currently running towards 1, or back towards 0. */
  readonly heading: 1 | -1;
}

export const PHASE_AT_REST: PhaseState = { t: 0, heading: -1 };

/**
 * Whether a beat has nothing left to do, so the frame loop can stop.
 *
 * Asked against the trigger rather than the beat's own heading, because those
 * disagree at exactly the moment that matters: a beat at rest has heading -1
 * and t of 0, and if it is asked whether it is finished without being told
 * that its trigger has just gone true, it answers yes and the loop never
 * starts.
 */
export function isPhaseAtTarget(state: PhaseState, active: boolean): boolean {
  return active ? state.t >= 1 : state.t <= 0;
}

/**
 * Moves a beat on by one frame.
 *
 * `active` is the trigger -- the only thing scroll is allowed to say. A single
 * step is capped at the full duration so that a tab left in the background,
 * which returns with a frame gap of several seconds, lands the beat at its end
 * instead of overshooting into a wild number.
 */
export function advancePhase(
  state: PhaseState,
  active: boolean,
  dtMs: number,
  durationMs: number
): PhaseState {
  const heading: 1 | -1 = active ? 1 : -1;

  if (!Number.isFinite(dtMs) || dtMs <= 0 || !(durationMs > 0)) {
    return heading === state.heading ? state : { t: state.t, heading };
  }

  const step = Math.min(dtMs, durationMs) / durationMs;
  const next = state.t + step * heading;
  return { t: next < 0 ? 0 : next > 1 ? 1 : next, heading };
}

/**
 * A threshold with a deadband, so a beat cannot chatter on its own edge.
 *
 * A reader resting the page one pixel either side of a bare threshold flips it
 * on every inertial wobble, and each flip restarts a 600ms movement -- which
 * looks far worse than the jitter this whole file exists to remove. `enter` is
 * the point that starts the beat and `exit`, which must be lower, is the point
 * that lets it back off.
 */
export function phaseGate(
  value: number,
  wasActive: boolean,
  enter: number,
  exit: number
): boolean {
  if (!Number.isFinite(value)) return wasActive;
  return wasActive ? value >= exit : value >= enter;
}

/**
 * Cubic in and out: 4t^3 below the midpoint, mirrored above it.
 *
 * Chosen over an exponential for a *triggered* movement specifically. Expo's
 * opening is so flat that the first sixth of the beat is invisible, which
 * after a deliberate trigger reads as the page having missed the input. Cubic
 * commits immediately, still has zero slope at both ends, and costs two
 * multiplies.
 */
export function easeInOutCubic(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
