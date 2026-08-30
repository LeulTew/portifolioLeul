/**
 * Strip-bend transition geometry.
 *
 * A set of narrow vertical strips whose tangents follow a curved arc, so a
 * change of content sweeps across with the give of a bending sheet rather than
 * pivoting like a stiff door. Kept as plain math so the curvature can be
 * asserted without rendering.
 */

/** Enough strips to read as a continuous bend, few enough to stay cheap. */
export const DEFAULT_STRIP_COUNT = 16;

/** Peak bend of the trailing edge, in degrees. */
const MAX_BEND_DEGREES = 45;

/** How much the far edge lags the near edge, as a share of the sweep. */
const LAG_SHARE = 0.2;

/** Peak contact shadow under the bend. */
const MAX_SHADOW = 0.4;

export interface StripTransform {
  /** Bend of this strip, in degrees. Zero at rest and at completion. */
  readonly angle: number;
  /** Horizontal travel, as a percentage of the strip's own width. */
  readonly translateX: number;
  /** Contact shadow opacity, strongest mid-sweep and at the leading edge. */
  readonly shadowOpacity: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Geometry for one strip at a point in the sweep.
 *
 * `angle` and `shadowOpacity` follow a half-sine, so the sheet is flat at both
 * ends of the transition and most bent in the middle.
 */
export function calculateStripTransform(
  stripIndex: number,
  totalStrips: number,
  turnProgress: number
): StripTransform {
  if (!Number.isFinite(totalStrips) || totalStrips <= 0) {
    return { angle: 0, translateX: 0, shadowOpacity: 0 };
  }

  const index = Number.isFinite(stripIndex) ? Math.max(stripIndex, 0) : 0;
  const normalizedIndex = Math.min(index / totalStrips, 1);
  const progress = clamp01(turnProgress);
  const bend = Math.sin(progress * Math.PI);

  return {
    angle: bend * normalizedIndex * MAX_BEND_DEGREES,
    translateX: progress * 100 * (1 - normalizedIndex * LAG_SHARE),
    shadowOpacity: bend * (1 - normalizedIndex) * MAX_SHADOW,
  };
}

/**
 * Fraction of the total duration that `stripIndex` waits before it starts.
 * Staggering is what makes the sweep read as a bend rather than a block wipe.
 */
export function stripDelayFraction(
  stripIndex: number,
  totalStrips: number,
  maxStagger = 0.35
): number {
  if (!Number.isFinite(totalStrips) || totalStrips <= 1) return 0;
  const index = Number.isFinite(stripIndex) ? Math.max(stripIndex, 0) : 0;
  const normalizedIndex = Math.min(index / (totalStrips - 1), 1);
  return normalizedIndex * clamp01(maxStagger);
}

/**
 * Commit threshold for a thrown gesture. Past this release velocity the sweep
 * completes; below it, it springs back.
 */
export const THROW_COMMIT_VELOCITY = 0.45;

/** Whether a release at `velocity` from `progress` should complete the sweep. */
export function shouldCommitTurn(
  progress: number,
  velocity: number,
  commitVelocity = THROW_COMMIT_VELOCITY
): boolean {
  if (!Number.isFinite(velocity)) return clamp01(progress) > 0.5;
  if (Math.abs(velocity) >= commitVelocity) return velocity > 0;
  return clamp01(progress) > 0.5;
}
