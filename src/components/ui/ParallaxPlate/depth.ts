/**
 * How far a layer at `depth` has travelled, given the stage's progress.
 *
 * Parallax is only depth if the layers disagree. A near layer moves further
 * than a far one for the same scroll, and the difference is the whole effect --
 * move them all by the same amount and the result is a picture sliding about,
 * which is what parallax looks like when it is done by eye.
 *
 * `depth` is 0 for the furthest plane and 1 for the nearest. `travel` is how
 * far the nearest plane moves across the stage, in whatever unit the caller
 * is working in.
 */
export function layerShift(progress: number, depth: number, travel: number): number {
  if (!Number.isFinite(progress)) return 0;
  if (!Number.isFinite(depth) || !Number.isFinite(travel)) return 0;

  const clampedDepth = depth <= 0 ? 0 : depth >= 1 ? 1 : depth;
  // Centred on the middle of the stage, so a layer sits still when the stage
  // does and leans the other way on the way out.
  return (progress - 0.5) * 2 * clampedDepth * travel;
}

/** The furthest plane still moves a little; nothing in view is nailed down. */
export const DEPTHS = [0.18, 0.42, 0.7, 1] as const;
