import type { SequenceLayer } from '../../ui/PinnedSequence';

/**
 * When each statement holds the stage.
 *
 * They do not overlap: the first is gone before the second begins, so the
 * background is the only thing continuous across the handover. That is what
 * makes the stretch read as standing still while things arrive, rather than as
 * two panels crossfading past each other.
 *
 * Its own module rather than a constant beside the component, so the component
 * file exports only components and fast refresh keeps working.
 */
export const STATEMENT_LAYERS: readonly SequenceLayer[] = [
  /*
   * The ground. Covers the whole stretch and ramps at both ends, so the world
   * is shut out for exactly as long as the reader is held and is given back on
   * the way out instead of being switched off.
   */
  { name: 'ground', start: 0, end: 1, feather: 0.14 },
  /*
   * The geometry leaves before the stretch does. Something still drifting as
   * the section hands over reads as scenery that was forgotten rather than
   * cleared.
   */
  { name: 'field', start: 0.02, end: 0.88, feather: 0.16 },
  { name: 'one', start: 0.08, end: 0.46 },
  { name: 'two', start: 0.54, end: 0.92 },
] as const;

/** Screens of scroll the held stretch spends. */
export const ABOUT_SCREENS = 4;
