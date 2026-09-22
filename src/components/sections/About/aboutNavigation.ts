import type { SectionNavigationOptions } from '@/lib/scroll/sectionNavigation';
import { STATEMENT_ARRIVE, STATEMENT_CLEAR_SPAN, STATEMENT_SWAP } from './aboutBeats';
import { ABOUT_SCREENS } from './statementLayers';

// Inside the first readable rest in both timed and reduced-motion playback,
// away from either threshold so subpixel scroll settlement cannot strand it.
const FIRST_READING_POSITION =
  (STATEMENT_ARRIVE.enter + STATEMENT_CLEAR_SPAN + STATEMENT_SWAP.exit) / 2;

export function aboutNavigationInset(
  viewportHeight: number,
  source?: SectionNavigationOptions['source'],
): number {
  return Math.round(viewportHeight * (source === 'navbar'
    ? (ABOUT_SCREENS - 1) * FIRST_READING_POSITION
    : 0.08));
}
