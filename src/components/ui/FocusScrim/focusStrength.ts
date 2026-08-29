/**
 * Share of the viewport a section must cover before the scrim reaches full
 * strength. Below this the scene stays legible around the copy.
 */
export const FULL_FOCUS_COVERAGE = 0.55;

/**
 * Maps how much of the *viewport* a section occupies onto scrim strength.
 *
 * Deliberately not IntersectionObserver's `intersectionRatio`, which is a
 * fraction of the observed element: a section six screens tall can never exceed
 * a ratio of ~0.17 no matter how completely it fills the screen.
 */
export function focusStrength(
  intersectionHeight: number,
  rootHeight: number,
  fullCoverage: number = FULL_FOCUS_COVERAGE
): number {
  if (!Number.isFinite(intersectionHeight) || intersectionHeight <= 0) return 0;
  if (!Number.isFinite(rootHeight) || rootHeight <= 0) return 0;

  const coverage = intersectionHeight / rootHeight;
  if (fullCoverage <= 0) return 1;

  const strength = coverage / fullCoverage;
  if (strength <= 0) return 0;
  return strength >= 1 ? 1 : strength;
}
