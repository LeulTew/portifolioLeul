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

/**
 * Base height of the drawing inside the viewBox.
 *
 * Grew with the curve. The sweep now runs 63.6 units further down before it
 * hands over to the straight run, and this carries the same 63.6 so the run
 * below the curve keeps the length it always had. Every measured mark still
 * comes out the height it was measured to be: `cueRunForHeight` subtracts this
 * number, so a bigger base simply asks for correspondingly less extra run.
 */
export const CUE_BASE_HEIGHT = 397.6;

/** Left edge of the viewBox, and the x the straight run falls down. */
export const CUE_VIEW_X = -2;
export const CUE_RUN_X = 52.3;

/**
 * Stroke width of the trace, in viewBox units, matching the stylesheet.
 *
 * Needed out here because the run has to be placed by the edge the reader
 * sees, not by its centre line. Half a stroke is under a pixel, which is
 * exactly the sort of thing that reads as "not quite lined up" without ever
 * looking like a bug.
 */
export const CUE_STROKE_WIDTH = 2;

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
export function cueRunOffset(widthPx: number): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return 0;
  const runEdge = CUE_RUN_X - CUE_STROKE_WIDTH / 2;
  return ((runEdge - CUE_VIEW_X) / CUE_VIEW_WIDTH) * widthPx;
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
