import { landsOnOwnEdge } from './landingEdge';
import type { SectionNavigationOptions } from './sectionNavigation';

/** What the fixed navbar covers at the top of the window. */
export const NAVBAR_CLEARANCE_PX = 80;

export interface LandingRequest {
  id: string;
  target: HTMLElement;
  /** A resumed chapter's own element inside the section: it lands under the navbar. */
  landing: HTMLElement | null;
  options?: SectionNavigationOptions;
  /** The window the reader reads through: drei's track, or the document's viewport. */
  viewportHeight: number;
  /** About lands inside its first readable beat; how deep is About's own measure. */
  aboutInset: (viewportHeight: number, source?: SectionNavigationOptions['source']) => number;
}

/**
 * Where a navigation puts the window's top, as a distance below the section's
 * own top; `null` for Home, which is the page's top. One answer for the 3D
 * track and the flat document, which each turn it into their own scroll
 * position: written twice, the two drifted apart in the order they asked.
 */
export function landingInset({ id, target, landing, options, viewportHeight, aboutInset }: LandingRequest): number | null {
  if (id === 'home') return null;
  // Both boxes share any translation, so their difference is the layout offset.
  if (landing) return landing.getBoundingClientRect().top - target.getBoundingClientRect().top - NAVBAR_CLEARANCE_PX;
  // Only navbar intent lands inside the first readable beat; natural handoffs keep the authored
  // heading entry and its completion gates.
  if (id === 'about') return aboutInset(viewportHeight, options?.source);
  // A reverse handoff lands at the chapter's end, as the reader left it.
  if (options?.edge === 'end') return target.offsetHeight - viewportHeight + NAVBAR_CLEARANCE_PX;
  // One pixel in: the scroll ratio can land a fraction above, drawing the chapter before as a hairline.
  return landsOnOwnEdge(target) ? 1 : -NAVBAR_CLEARANCE_PX;
}
