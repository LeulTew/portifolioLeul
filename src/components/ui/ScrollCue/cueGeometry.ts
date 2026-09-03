/**
 * How long the handover mark is, kept apart from the component that draws it.
 *
 * The mark spans the measured gap between the hero and About, so the caller
 * has to turn a pixel height into the run the path needs. That is a function
 * rather than a component, and a module that exports both defeats fast
 * refresh -- hence its own file.
 */

/** Width of the viewBox, and the base height of the drawing inside it. */
export const CUE_VIEW_WIDTH = 67;
export const CUE_BASE_HEIGHT = 334;

/**
 * Extra straight run, in viewBox units, that makes the mark a given height.
 *
 * The mark is drawn at a fixed aspect (`meet`, so it never distorts), which
 * means a taller box alone does not make a longer line -- it fits the width
 * and leaves the rest of the box empty. Lengthening the run is what actually
 * makes the line longer, and only the straight part grows: the curve at the
 * top and the head at the bottom keep their proportions.
 */
export function cueRunForHeight(heightPx: number, widthPx: number): number {
  if (!Number.isFinite(heightPx) || !Number.isFinite(widthPx)) return 0;
  if (heightPx <= 0 || widthPx <= 0) return 0;

  return Math.max(0, (heightPx * CUE_VIEW_WIDTH) / widthPx - CUE_BASE_HEIGHT);
}
