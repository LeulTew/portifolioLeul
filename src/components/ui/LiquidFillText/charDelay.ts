/**
 * Uniform by default. A per-letter offset makes the word fill left to right,
 * which reads as a sweep across the text rather than snow settling into it --
 * snow does not arrive at one end of a word first. Pass a step only where a
 * deliberate march is wanted.
 */
export const BASE_STEP_MS = 0;

/** Below 1, so each successive letter follows a little sooner than the last. */
const STEP_FALLOFF = 0.82;

/**
 * When a letter starts filling. With a non-zero step the stagger decelerates
 * along the word, so the fill runs through the letters rather than stepping
 * between them at a fixed interval, which is what makes a stagger read as
 * mechanical.
 */
export function charDelayMs(index: number, stepMs = BASE_STEP_MS): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.round(Math.pow(index, STEP_FALLOFF) * stepMs);
}
