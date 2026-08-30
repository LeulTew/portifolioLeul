/**
 * How present a layer is at `progress`, given the slice of the sequence it
 * owns.
 *
 * Zero at the edges of its window and full in the middle, with smoothstepped
 * ramps of `feather` at each end. Layers that own different slices therefore
 * take the stage in turn: one is already gone before the next has begun, which
 * is what makes a pinned sequence read as things arriving on a held background
 * rather than as a list scrolling past.
 */
export function windowPresence(
  progress: number,
  start: number,
  end: number,
  feather: number
): number {
  if (!Number.isFinite(progress)) return 0;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  if (!Number.isFinite(feather) || feather <= 0) {
    return progress >= start && progress <= end ? 1 : 0;
  }

  if (progress <= start || progress >= end) return 0;

  // Whichever edge is nearer decides, so a window narrower than two feathers
  // still peaks in its middle instead of overlapping into nonsense.
  const rise = (progress - start) / feather;
  const fall = (end - progress) / feather;
  const nearness = Math.min(rise, fall, 1);

  return nearness * nearness * (3 - 2 * nearness);
}

/**
 * How opaque a layer is, from how present it is.
 *
 * Steeper than presence on purpose. Tying opacity and blur to the same value
 * means a layer at a fifth of its presence is drawn at a fifth opacity under a
 * heavy blur -- a large soft ghost, legible as text, sitting on screen for the
 * whole approach. Cubing it keeps the layer at nothing until it is most of the
 * way in, so what arrives is something coming into focus rather than something
 * that was already there being sharpened.
 */
export function layerOpacity(presence: number): number {
  if (!Number.isFinite(presence) || presence <= 0) return 0;
  const clamped = presence >= 1 ? 1 : presence;
  return clamped * clamped * clamped;
}
