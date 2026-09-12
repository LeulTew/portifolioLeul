/**
 * Geometry for Education entry, release and the selected record's track.
 *
 * Scroll never selects a record. The playback controller accepts one fresh
 * wave or control activation after the complete crossing and reading pause.
 */

/**
 * How far the frame has to be carried off the top once the hold is over.
 *
 * Zero for the whole hold, which is the point: a fixed overlay offset by zero
 * is held by the browser rather than by arithmetic, and cannot drift against
 * the layer underneath it. Only the release moves, and the release is supposed
 * to be moving.
 */
export function releaseOffset(railTop: number, railHeight: number, frameHeight: number): number {
  if (!Number.isFinite(railTop)) return 0;
  if (!Number.isFinite(railHeight) || !Number.isFinite(frameHeight)) return 0;

  const travel = Math.max(railHeight - frameHeight, 0);
  const overrun = -railTop - travel;
  return overrun <= 0 ? 0 : Math.round(overrun);
}

/**
 * Whether the frame should be on screen at all.
 *
 * Before the hold the About sequence's own overlay is still covering this, and
 * after the release the frame has been carried clear of the top; a fixed
 * overlay left switched on either side of that would sit over sections it has
 * nothing to do with.
 */
export function stageVisible(railTop: number, railHeight: number, frameHeight: number): boolean {
  if (!Number.isFinite(railTop) || railTop > 0) return false;
  return releaseOffset(railTop, railHeight, frameHeight) < frameHeight;
}

/** Where the track has to sit for `index` to be the record on screen, in xPercent. */
export function trackOffset(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(index) || index <= 0) return 0;
  return -(index * 100) / count;
}
