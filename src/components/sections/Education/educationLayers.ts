import type { SequenceLayer } from '../../ui/PinnedSequence';
import { spreadLayers } from '@/lib/motion/spreadLayers';
import { cvData } from '../../../data/cv';

/** One reveal window per entry, named by position so the CSS can address it. */
export const ENTRY_NAMES = cvData.education.map((_, index) => `e${index}`);

export const EDUCATION_LAYERS: readonly SequenceLayer[] = [
  /*
   * The panel that hides the world. Up for the whole stretch on the left,
   * where the portal stands; the right half is a separate layer because it is
   * the thing that goes away.
   */
  { name: 'panel', start: 0, end: 1, feather: 0.08 },
  /* The heading, up almost at once and held: it names what is being read. */
  { name: 'head', start: 0, end: 1, feather: 0.04 },
  /*
   * The frame draws itself before anything is inside it -- an empty box that
   * then fills, rather than a box that arrives already full.
   */
  { name: 'frame', start: 0.01, end: 1, feather: 0.06 },
  /*
   * The aperture: how far the right-hand panel has drawn back off the world.
   * It opens after the frame has been established and stays open, so the scene
   * behind is the last thing the reader is left with.
   */
  { name: 'aperture', start: 0.12, end: 1, feather: 0.28 },
  ...spreadLayers(ENTRY_NAMES, 0.16, 0.95),
] as const;

/**
 * Screens of scroll the stretch spends.
 *
 * One per entry plus one for the frame to open and the aperture to draw back,
 * so adding an entry lengthens the stretch instead of squeezing the others.
 */
export const EDUCATION_SCREENS = cvData.education.length + 1;
