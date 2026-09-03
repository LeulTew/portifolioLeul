import { getWorldOcclusion } from '@/lib/camera/cameraHold';
import { isWithinHold } from '@/lib/camera/holdRange';
import { getScrollProgress } from '@/lib/scroll/scrollProgress';

/**
 * One decision per frame, shared by everything that would spend time on it:
 * is this frame going to be drawn at all?
 *
 * Two things make frames free to skip.
 *
 * A section covers the world outright for several screens of scroll -- the
 * same stretch the camera already holds still for. Behind a fully opaque panel
 * the renderer is drawing 220K triangles and a water reflection pass that no
 * one can see. Skipping the draw there is invisible by construction: the hold
 * is measured from the very section doing the covering.
 *
 * And on a weak GPU a 3D backdrop does not need to redraw as often as the page
 * scrolls. The camera arc is damped on elapsed time rather than on frame
 * count, so a capped redraw rate changes where the camera is on the frames it
 * does draw by nothing at all.
 *
 * The gate is queried by the render governor *and* by the per-frame writers
 * that feed it -- the drifting motes, the starfield, the water clock. Whoever
 * asks first settles the frame, so all of them skip together and a skipped
 * frame costs neither the CPU work nor the draw.
 */

/** Elapsed time of the frame the current decision belongs to. */
let decidedAt = Number.NaN;
let decision = true;
let lastDrawnAt = Number.NEGATIVE_INFINITY;

/** Minimum seconds between draws. Zero means every frame. */
let minInterval = 0;

/**
 * Slack on the interval, in seconds.
 *
 * Frames arrive on the display's grid, and a 30fps budget on a 60Hz display
 * puts every eligible frame exactly on the boundary -- where a strict
 * comparison decides on a floating-point last bit. Each frame refused that way
 * pushes the next draw a whole frame later, and the cadence walks: measured
 * over a second, a 30fps budget delivered 22.
 *
 * A millisecond is far below any real frame interval, so it cannot let an
 * extra frame through, but it is comfortably above the rounding.
 */
const INTERVAL_SLACK = 0.001;

/**
 * Sets the redraw budget. Called once from the render governor, which owns the
 * GPU tier reading.
 */
export function setFrameBudget(secondsBetweenDraws: number): void {
  minInterval = Number.isFinite(secondsBetweenDraws) && secondsBetweenDraws > 0
    ? secondsBetweenDraws
    : 0;
}

/** True while an opaque section covers the world completely. */
export function isWorldOccluded(): boolean {
  return isWithinHold(getScrollProgress(), getWorldOcclusion());
}

/**
 * Whether the frame at `time` will be drawn.
 *
 * Idempotent within a frame: the first caller decides and every later caller
 * in the same frame is handed the same answer, so the governor cannot draw a
 * frame whose inputs were skipped, or skip one whose inputs were written.
 */
export function isFrameDrawn(time: number): boolean {
  if (!Number.isFinite(time)) return true;
  if (time === decidedAt) return decision;

  decidedAt = time;

  if (isWorldOccluded()) {
    decision = false;
    return decision;
  }

  // A clock that has gone backwards is a clock that restarted, not a frame
  // arriving early. Without this the gate reads the jump as "no time has
  // passed since the last draw" and refuses every frame from then on.
  if (time < lastDrawnAt) lastDrawnAt = Number.NEGATIVE_INFINITY;

  if (time - lastDrawnAt < minInterval - INTERVAL_SLACK) {
    decision = false;
    return decision;
  }

  lastDrawnAt = time;
  decision = true;
  return decision;
}

/** Test-only: forget the budget and any frame already decided. */
export function resetFrameGate(): void {
  decidedAt = Number.NaN;
  decision = true;
  lastDrawnAt = Number.NEGATIVE_INFINITY;
  minInterval = 0;
}
