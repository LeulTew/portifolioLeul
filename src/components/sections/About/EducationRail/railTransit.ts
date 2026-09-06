/**
 * The scroll-to-record maths for the education rail.
 *
 * Kept apart from the component because it is the only part with a right
 * answer: given where the rail sits in the viewport, how far is the frame
 * pinned and which record is being read. The component owns the DOM writes and
 * the tweens; this owns the numbers.
 *
 * Note what is deliberately *not* here: how far the track has travelled.
 * Scroll picks the record; a fixed-duration tween does the crossing. Scrubbing
 * the travel would make the animation a function of how fast the reader turned
 * the wheel, so a flick would blur four records past in one frame and a careful
 * scroll would show a slideshow. One record, one crossing, always the same.
 */

/** Clamps to [0, 1] and treats anything non-finite as 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * How far through its hold the rail is, in pixels of scroll spent.
 *
 * Note what this is *not* used for: the frame is not offset by it. The frame
 * is held by being on a fixed overlay, so during the hold it does not move at
 * all and there is nothing to keep in step frame by frame. This number only
 * says which record is being read.
 */
export function pinOffset(railTop: number, railHeight: number, frameHeight: number): number {
  if (!Number.isFinite(railTop)) return 0;
  if (!Number.isFinite(railHeight) || !Number.isFinite(frameHeight)) return 0;

  const travel = Math.max(railHeight - frameHeight, 0);
  const wanted = -railTop;

  if (wanted <= 0) return 0;
  return Math.round(wanted > travel ? travel : wanted);
}

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

/** How far through its own pin the rail is, in [0, 1]. */
export function pinProgress(pin: number, railHeight: number, frameHeight: number): number {
  const travel = Math.max(railHeight - frameHeight, 0);
  if (travel <= 0) return 0;
  return clamp01(pin / travel);
}

/**
 * Rescales the middle of the pin onto the [0, 1] the records run on.
 *
 * The pin opens with the frame drawing itself and the heading giving up its
 * space, and closes with the frame being let go. Handing the records the raw
 * pin would spend the first record on scroll nobody was reading it through.
 */
export function recordWindow(progress: number, start = 0.14, end = 0.92): number {
  if (!(end > start)) return 0;
  return clamp01((clamp01(progress) - start) / (end - start));
}

/**
 * Which record the reader is on.
 *
 * Each record owns an equal share of the window. The last one keeps the top
 * edge, so arriving at the very end of the pin does not land one past the set.
 */
export function recordAt(progress: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const index = Math.floor(clamp01(progress) * count);
  return index > count - 1 ? count - 1 : index;
}

/** Where the track has to sit for `index` to be the record on screen, in xPercent. */
export function trackOffset(index: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (!Number.isFinite(index) || index <= 0) return 0;
  return -(index * 100) / count;
}

/**
 * The scroll distance worth one record.
 *
 * The prev and next controls move the reader rather than the track: scroll
 * chooses the record, so nudging the scroll is the only way to change one
 * without leaving the two out of step the moment the wheel is touched again.
 */
export function stepDistance(railHeight: number, frameHeight: number, count: number): number {
  if (!Number.isFinite(count) || count <= 1) return 0;
  const travel = Math.max(railHeight - frameHeight, 0);
  if (travel <= 0) return 0;
  return ((0.92 - 0.14) * travel) / count;
}
