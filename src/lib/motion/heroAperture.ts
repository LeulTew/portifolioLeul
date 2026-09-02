/**
 * The hero's aperture: the world opens vertically from a slit.
 *
 * Two bands meet at the horizon of the hero, leaving a thin strip of the
 * island showing between them. They retract on arrival, so the first thing the
 * page does is widen -- the sea and the sky pushing apart from a single line
 * rather than fading up out of nothing.
 *
 * The entrance only. The exit is the copy's own plate drawing shut around
 * where the name was, which is a closer, more particular thing than the whole
 * frame letterboxing; two vertical closes on one screen would simply have
 * competed.
 *
 * The geometry lives here, as pure functions, because the numbers below are
 * the difference between a cinema shutter and a slide transition and they are
 * worth pinning down.
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
