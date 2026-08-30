/**
 * Section entry sequences and the shared exit transform.
 *
 * See SECTION_CHOREOGRAPHY.md for the rules these encode: layers arrive
 * back-to-front on a timed sequence, and the exit is scrubbed from scroll
 * rather than played on its own clock.
 */

/** Which engine drives a layer. Recorded so the sequence documents itself. */
export type CueEngine = 'framer' | 'gsap';

export interface SectionCue {
  /** Layer this cue drives. Unique within a sequence. */
  readonly id: string;
  /** Start offset from the top of the sequence, in seconds. */
  readonly at: number;
  /** How long the layer takes to arrive, in seconds. */
  readonly duration: number;
  readonly engine: CueEngine;
}

/**
 * Hero: backdrop, then the portrait the eye lands on, then type from largest
 * to smallest, then the controls, and the scroll cue last so it invites the
 * next move rather than competing with what just arrived.
 */
export const HERO_SEQUENCE: readonly SectionCue[] = [
  { id: 'backdrop', at: 0, duration: 0.9, engine: 'framer' },
  { id: 'portrait', at: 0.18, duration: 0.7, engine: 'framer' },
  { id: 'title', at: 0.32, duration: 0.9, engine: 'gsap' },
  { id: 'role', at: 0.52, duration: 0.7, engine: 'gsap' },
  { id: 'description', at: 0.66, duration: 0.7, engine: 'gsap' },
  { id: 'actions', at: 0.82, duration: 0.6, engine: 'framer' },
  { id: 'affordance', at: 1.04, duration: 0.8, engine: 'framer' },
] as const;

/** Coverage at which a section counts as having arrived. */
export const ENTER_THRESHOLD = 0.35;

/** Coverage below which the exit is fully played out. */
export const EXIT_THRESHOLD = 0.55;

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

/** Delay before `id` starts, in seconds. Zero for an unknown layer. */
export function cueDelay(sequence: readonly SectionCue[], id: string): number {
  const cue = sequence.find((entry) => entry.id === id);
  return cue ? cue.at : 0;
}

/** Duration of `id`, in seconds. Falls back to a sane default if unknown. */
export function cueDuration(
  sequence: readonly SectionCue[],
  id: string,
  fallback = 0.7
): number {
  const cue = sequence.find((entry) => entry.id === id);
  return cue ? cue.duration : fallback;
}

/** Wall-clock length of the whole sequence, in seconds. */
export function sequenceDuration(sequence: readonly SectionCue[]): number {
  return sequence.reduce((longest, cue) => Math.max(longest, cue.at + cue.duration), 0);
}

/**
 * How far through its exit a section is: 0 while focused, 1 once gone.
 *
 * Only meaningful after the section has entered -- a section on its way in has
 * low coverage too, and must not be treated as leaving.
 */
export function exitAmount(coverage: number, threshold: number = EXIT_THRESHOLD): number {
  if (threshold <= 0) return 0;
  return 1 - clamp01(coverage / threshold);
}

export interface ExitStyle {
  opacity: number;
  transform: string;
  filter: string;
}

/** Never a hard zero: vanishing early reads as a bug rather than a transition. */
const MIN_EXIT_OPACITY = 0.15;
const MAX_EXIT_RISE = 64;
const MIN_EXIT_SCALE = 0.965;
const MAX_EXIT_BLUR = 5;

/**
 * The shared out-of-focus transform. Pure, so it can be applied straight to a
 * style attribute without an animation of its own.
 */
export function exitStyle(amount: number, reducedMotion = false): ExitStyle {
  const t = clamp01(amount);
  const opacity = 1 - t * (1 - MIN_EXIT_OPACITY);

  if (reducedMotion) {
    // Legibility is not a motion effect: keep the fade, drop the movement.
    return { opacity, transform: 'none', filter: 'none' };
  }

  const rise = -t * MAX_EXIT_RISE;
  const scale = 1 - t * (1 - MIN_EXIT_SCALE);
  const blur = t * MAX_EXIT_BLUR;

  return {
    opacity,
    transform: `translate3d(0, ${rise.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
    filter: blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none',
  };
}
