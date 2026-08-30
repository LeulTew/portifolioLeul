/**
 * How far through a pinned stretch the reader is, from the spacer's position.
 *
 * The spacer is the scroll the sequence consumes. It starts when the spacer's
 * top reaches the top of the screen and ends when its bottom does, so for the
 * whole of that stretch the overlay is held still and only its contents change
 * -- which is the difference between a section that plays as you pass it and
 * one you are held inside while it plays.
 */
export function localProgress(spacerTop: number, spacerHeight: number, rootHeight: number): number {
  if (!Number.isFinite(spacerTop)) return 0;
  if (!Number.isFinite(spacerHeight) || spacerHeight <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  // What is left to travel once the last screenful is discounted: the spacer
  // has stopped being scrolled through when its bottom reaches the bottom of
  // the screen, not when it reaches the top.
  const travel = spacerHeight - rootHeight;
  if (travel <= 0) return spacerTop <= 0 ? 1 : 0;

  const moved = -spacerTop / travel;
  if (moved <= 0) return 0;
  return moved >= 1 ? 1 : moved;
}
