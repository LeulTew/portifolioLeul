/**
 * How far through a run of sections the reader is, from the run's own box.
 *
 * The run starts when its top reaches the top of the screen and ends when its
 * bottom reaches the bottom, so it is spent over exactly the scroll it
 * occupies -- the same measure a single pinned stretch uses, applied to
 * several sections at once.
 */
export function runProgress(top: number, height: number, rootHeight: number): number {
  if (!Number.isFinite(top)) return 0;
  if (!Number.isFinite(height) || height <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  const travel = height - rootHeight;
  if (travel <= 0) return top <= 0 ? 1 : 0;

  const moved = -top / travel;
  if (moved <= 0) return 0;
  return moved >= 1 ? 1 : moved;
}

/**
 * The ground's strength: up as the run begins, held, and down as it ends.
 *
 * Ramped rather than switched at both ends, and ramped over the run as a whole
 * rather than per section. A ground handed over between sections is a ground
 * that goes out and comes back, and the gap between them is the world flashing
 * through -- which is the thing this exists to prevent.
 */
export function runGround(progress: number, rise = 0.04, fall = 0.05): number {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  if (progress >= 1) return 0;

  const inAmount = rise > 0 ? Math.min(progress / rise, 1) : 1;
  const outAmount = fall > 0 ? Math.min((1 - progress) / fall, 1) : 1;
  const amount = Math.min(inAmount, outAmount);

  return amount * amount * (3 - 2 * amount);
}
