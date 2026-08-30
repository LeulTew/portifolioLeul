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
  { name: 'one', start: 0.06, end: 0.46 },
  { name: 'two', start: 0.54, end: 0.94 },
] as const;

/** Screens of scroll the held stretch spends. */
export const ABOUT_SCREENS = 4;
