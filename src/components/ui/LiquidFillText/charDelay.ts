/** Spacing between letters at the head of the word, in ms. */
export const BASE_STEP_MS = 62;

/** Below 1, so each successive letter follows a little sooner than the last. */
const STEP_FALLOFF = 0.82;

/**
 * When a letter starts filling. The stagger decelerates along the word, so the
 * fill runs through the letters rather than stepping between them at a fixed
 * interval, which is what makes a stagger read as mechanical.
 */
export function charDelayMs(index: number, stepMs = BASE_STEP_MS): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.round(Math.pow(index, STEP_FALLOFF) * stepMs);
}
