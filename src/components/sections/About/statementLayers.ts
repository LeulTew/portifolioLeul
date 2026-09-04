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
   * The ground. Covers the whole stretch and ramps in at the start.
   * End is set to 2 so ground-in stays at full 1.0 strength through the end of the
   * sequence and seamlessly hands over to the Education section without disappearing.
   */
  { name: 'ground', start: 0, end: 2, feather: 0.09 },
  /*
   * The geometry leaves before the stretch does. Something still drifting as
   * the section hands over reads as scenery that was forgotten rather than
   * cleared.
   */
  { name: 'field', start: 0.01, end: 0.9, feather: 0.13 },
  /*
   * The heading, and it arrives while the arrow is still pointing at it.
   *
   * The hero hands over by drawing a line down the page, and the head of that
   * line comes to rest just above this heading at the moment the panel reaches
   * the top of the window. That is the composition the whole handover is for,
   * and it only exists if the heading is up while the mark is still there --
   * so it starts the instant the stretch does, on a short ramp.
   *
   * It used to start a twentieth of the way in on a long ramp, which put it at
   * full strength some four hundred pixels of scroll later: by then the mark
   * had been carried off the top and the heading arrived into an empty screen,
   * pointed at by nothing.
   */
  { name: 'head', start: 0, end: 1, feather: 0.04 },
  /*
   * The statements follow the mark out rather than competing with it.
   *
   * The arrow leaves the top of the window a little under a tenth of the way
   * in; the copy arrives as it goes, so the reader is handed from one to the
   * other. Starting at 0.03 -- which is what this was -- had the statements
   * animating in underneath a heading that had not arrived yet and a mark that
   * was still pointing at it.
   */
  { name: 'one', start: 0.07, end: 0.44 },
  { name: 'two', start: 0.50, end: 0.78 },
  /*
   * Background pixel transition (runrobrun stepped bottom-up pixel growth).
   * Takes over AFTER statement two has completely disappeared (progress > 0.78),
   * climbing from the bottom up in castellated columns to transition the background
   * into dark greenish (#001a1a) or emerald green (#0a5c40).
   */
  { name: 'bgTransition', start: 0.78, end: 1.0, feather: 0.04 },
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
