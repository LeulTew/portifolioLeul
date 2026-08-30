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
  { name: 'ground', start: 0, end: 1, feather: 0.09 },
  /*
   * The geometry leaves before the stretch does. Something still drifting as
   * the section hands over reads as scenery that was forgotten rather than
   * cleared.
   */
  { name: 'field', start: 0.01, end: 0.9, feather: 0.13 },
  /*
   * The heading. Up almost immediately and held for the whole stretch: it
   * names the section, so it has to be there for as long as the section is.
   */
  { name: 'head', start: 0, end: 1, feather: 0.04 },
  { name: 'one', start: 0.03, end: 0.47 },
  { name: 'two', start: 0.53, end: 0.97 },
] as const;

/**
 * Screens of scroll the held stretch spends.
 *
 * Three, not four. Every screen here is scroll the reader spends without
 * arriving anywhere new, so the stretch has to be long enough for two
 * statements to take their turn and no longer: past that it stops reading as
 * being held and starts reading as being stuck.
 */
export const ABOUT_SCREENS = 3;
