/**
 * Keeps the reader in place when the scroll track is resized.
 *
 * `ScrollControls` lists `pages` in the dependencies of the effect that builds
 * its track, and that effect resets `scrollTop` to 1 every time it re-runs. So
 * any change to the page count -- a lazily loaded image, an expanding card,
 * a category swap -- yanks the page back to the top.
 *
 * The content is translated by `offset * (pages - 1) * viewportHeight`, so
 * holding the reader still across a resize means solving for the offset that
 * reproduces the same translation under the new page count.
 */

/**
 * Normalized offset that keeps the same content under the reader after the
 * page count changes from `previousPages` to `nextPages`.
 */
export function preserveScrollOffset(
  offset: number,
  previousPages: number,
  nextPages: number
): number {
  if (!Number.isFinite(offset) || offset <= 0) return 0;

  const previousTravel = previousPages - 1;
  const nextTravel = nextPages - 1;

  // A single-page track has nowhere to scroll, so there is nothing to preserve.
  if (!Number.isFinite(previousTravel) || previousTravel <= 0) return 0;
  if (!Number.isFinite(nextTravel) || nextTravel <= 0) return 0;

  const preserved = (offset * previousTravel) / nextTravel;
  if (preserved <= 0) return 0;
  return preserved >= 1 ? 1 : preserved;
}

/** Current normalized scroll offset of a track element. */
export function readScrollOffset(element: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  const scrollable = element.scrollHeight - element.clientHeight;
  if (!Number.isFinite(scrollable) || scrollable <= 0) return 0;
  const offset = element.scrollTop / scrollable;
  if (!Number.isFinite(offset) || offset <= 0) return 0;
  return offset >= 1 ? 1 : offset;
}
