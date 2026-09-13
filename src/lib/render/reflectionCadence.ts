/** Reuse the reflection texture between updates; the water still renders every drawn frame. */
export function createReflectionCadence(fps: number) {
  let previous = Number.NEGATIVE_INFINITY;
  return (time: number): boolean => {
    if (!(fps > 0) || !Number.isFinite(time)) return true;
    if (time >= previous && time - previous < 1 / fps - 0.001) return false;
    previous = time;
    return true;
  };
}
