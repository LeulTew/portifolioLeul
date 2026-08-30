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

/** The widest surface tile, so a phase can land anywhere within the pattern. */
export const WAVE_PERIOD_PX = 47;

/**
 * How far a letter's surface is shifted along, in px.
 *
 * The crests are a repeating pattern, so without this every letter carries the
 * same wave in the same place -- and a row of identical waves is the clearest
 * possible sign that a machine drew them. Shifting each letter by a different
 * amount within the pattern's period costs nothing and breaks the repeat.
 *
 * Deterministic rather than random: the same letter must get the same phase on
 * every render, or React re-rendering the word would make the surface jump.
 * The multiplier is prime and coprime with the period, so successive letters
 * land far apart instead of walking steadily along the pattern.
 */
export function wavePhasePx(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  const step = (Math.round(index) * 19) % WAVE_PERIOD_PX;
  // Centred on zero, so the surface is not biased in one direction.
  return step - Math.floor(WAVE_PERIOD_PX / 2);
}
