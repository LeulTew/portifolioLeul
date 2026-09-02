/**
 * The hero's aperture: the world opens vertically from a slit, and shuts back
 * into one as the reader leaves.
 *
 * Two bands meet at the horizon of the hero, leaving a thin strip of the
 * island showing between them. They retract on arrival, so the first thing the
 * page does is widen -- the sea and the sky pushing apart from a single line
 * rather than fading up out of nothing. On the way out they close again.
 *
 * The geometry lives here, as pure functions, for two reasons. It is shared by
 * the entry animation and by the scroll that closes it, and those two must
 * agree exactly or the bands jump the moment the reader starts moving. And it
 * is the part worth pinning down: the numbers below are the difference between
 * a cinema shutter and a slide transition.
 */

/**
 * How much of each band stays open at rest, as a share of that band's height.
 *
 * Not zero, which is the whole idea: at rest the aperture is a letterbox
 * showing a live sliver of the world, not a black screen. Twelve percent of a
 * half is six percent of the viewport, which on a laptop is a band deep enough
 * to read as an image rather than as a seam.
 */
export const SLIT_SHARE = 0.12;

/**
 * Where in the hero's exit the aperture starts and finishes closing.
 *
 * Deliberately later than the copy, which is already leaving from the first
 * pixel of scroll. Shutting the aperture on top of the copy would put two
 * things in motion at once and read as a single crude wipe; letting the copy
 * clear first and then closing behind it is a sequence, and it is the reason
 * the exit reads as deliberate.
 */
export const CLOSE_START = 0.34;
export const CLOSE_END = 0.94;

/** Hermite smoothstep between two edges. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0;
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * How far through its close the aperture is, given the hero's exit progress.
 *
 * Eased rather than linear, so the bands are already moving at speed by the
 * time they are noticed and settle rather than stop.
 */
export function closeAmount(exit: number): number {
  return smoothstep(CLOSE_START, CLOSE_END, clamp01(exit));
}

/**
 * The single value the bands are driven by: 0 is the slit, 1 is wide open.
 *
 * `opened` is the entry animation and `closed` is the scroll. Multiplying them
 * means the scroll can only ever take away what the entry has given, so a
 * reader who scrolls during the opening gets one continuous movement instead of
 * two animations fighting over the same element.
 */
export function apertureOpenness(opened: number, closed: number): number {
  return clamp01(opened) * (1 - clamp01(closed));
}

/**
 * Vertical scale of one band, for `transform: scaleY`.
 *
 * A transform rather than a height so the whole thing stays on the
 * compositor: the bands never trigger layout, which is what lets this run over
 * a live WebGL canvas without costing the scene anything.
 */
export function bandScale(openness: number, slitShare: number = SLIT_SHARE): number {
  return (1 - clamp01(openness)) * (1 - clamp01(slitShare));
}

/**
 * Strength of the light line where the bands meet.
 *
 * At rest the two edges sit against each other and the seam is bright; it
 * fades out well before the aperture is halfway open, so it reads as the
 * moment of ignition rather than as a glow that lingers over the scene.
 */
export function seamPresence(openness: number): number {
  return 1 - smoothstep(0.02, 0.46, clamp01(openness));
}

/**
 * Horizontal spread of the seam, 0 to 1.
 *
 * The line draws outward from the centre as the aperture begins to move, so it
 * does not simply appear at full width. This is the flourish that makes the
 * open read as a switch being thrown.
 */
export function seamSpread(openness: number): number {
  return smoothstep(0, 0.14, clamp01(openness));
}
