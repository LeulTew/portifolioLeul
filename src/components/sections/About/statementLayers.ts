import type { SequenceLayer } from '../../ui/PinnedSequence';

/**
 * When each layer of the held About stretch is present, as sequence progress.
 *
 * Positions request the beats; their own clocks play them (see aboutBeats.ts).
 * Its own module so the component file exports only components (fast refresh).
 */
export const STATEMENT_LAYERS: readonly SequenceLayer[] = [
  // Ground: in from the start and held past the end (end 2) into Education.
  { name: 'ground', start: 0, end: 2, feather: 0.09 },
  /*
   * Heading: present from the instant the stretch begins, while the hero's arrow
   * still points at it. This presence only triggers the timed HEAD_REVEAL; it
   * never draws the heading's masks itself.
   */
  { name: 'head', start: 0, end: 1, feather: 0.04 },
  /*
   * Statements follow the arrow out. They cross over across 0.38-0.46, both at
   * half presence at 0.42, so the stage is never empty between them.
   */
  { name: 'one', start: 0.07, end: 0.46, feather: 0.08 },
  { name: 'two', start: 0.38, end: 0.78, feather: 0.08 },
  // Stepped, bottom-up pixel background, once statement two has gone.
  { name: 'bgTransition', start: 0.78, end: 1.0, feather: 0.04 },
] as const;

/**
 * Screens of scroll the held stretch spends: long enough for two statements to
 * take their turn and no longer -- past that, being held starts to read as stuck.
 */
export const ABOUT_SCREENS = 3;