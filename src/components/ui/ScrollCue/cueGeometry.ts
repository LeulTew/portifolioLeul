/**
 * How long the handover mark is, kept apart from the component that draws it.
 *
 * The mark spans the measured gap between the hero and About, so the caller
 * has to turn a pixel height into the run the path needs. That is a function
 * rather than a component, and a module that exports both defeats fast
 * refresh -- hence its own file.
 */

/** Width of the viewBox, and the base height of the drawing inside it. */
export const CUE_VIEW_WIDTH = 112;

/**
 * Base height of the drawing inside the viewBox.
 *
 * The curve keeps its proportions; only the final straight run lengthens.
 */
export const CUE_BASE_HEIGHT = 360;

/** Left edge of the viewBox, and the x the straight run falls down. */
export const CUE_VIEW_X = 0;
export const CUE_VIEW_Y = 10;
export const CUE_RUN_X = 24;
export const CUE_START_X = 90;

/**
 * Non-scaling stroke width in CSS pixels, matching the stylesheet.
 *
 * Needed out here because the run has to be placed by the edge the reader
 * sees, not by its centre line. Half a stroke is under a pixel, which is
 * exactly the sort of thing that reads as "not quite lined up" without ever
 * looking like a bug.
 */
export const CUE_STROKE_WIDTH = 2.4;

/**
 * How far the run's left edge sits from the left edge of the rendered box.
 *
 * The mark is drawn at a fixed aspect inside its box, so the line the reader
 * actually sees is not at the box's centre -- it is most of the way to the
 * right of it. Placing the box by its centre put the line some twenty pixels
 * right of where it was meant to be, which is why it did not sit on the
 * heading it points at.
 *
 * Measured to the stroke's left edge rather than its centre. A heading is
 * aligned by the edge of its first glyph, and `A` in this face has no left
 * side bearing at all -- measured, its ink begins exactly on the text origin.
 * So a run centred on that origin hangs half a stroke into the margin, and
 * the line and the letter visibly do not start together.
 */
export function cueViewX(mirrored = false): number {
  return mirrored ? 2 * CUE_RUN_X - CUE_VIEW_X - CUE_VIEW_WIDTH : CUE_VIEW_X;
}

export function cueRunOffset(widthPx: number, mirrored = false): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return 0;
  return ((CUE_RUN_X - cueViewX(mirrored)) / CUE_VIEW_WIDTH) * widthPx - CUE_STROKE_WIDTH / 2;
}

export function cueStartOffset(widthPx: number): number {
  return (CUE_START_X - CUE_VIEW_X) * widthPx / CUE_VIEW_WIDTH - CUE_STROKE_WIDTH / 2;
}

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
