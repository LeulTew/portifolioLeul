/**
 * The stretch of scroll during which the 3D world holds completely still.
 *
 * One section covers the background outright rather than veiling it, and there
 * is nothing to see behind an opaque panel. Freezing the world there keeps the
 * reader's attention on the copy, and costs nothing to render.
 *
 * Expressed in normalized page-scroll terms so it adapts to any viewport: the
 * same section occupies a very different share of the scroll on a tablet and
 * on a 4K display.
 */

export interface ArcHold {
  /** Scroll progress at which the world freezes. */
  readonly start: number;
  /** Scroll progress at which it starts moving again. */
  readonly end: number;
}

export const NO_HOLD: ArcHold = { start: 0, end: 0 };

/** Length of scroll a hold consumes without advancing the camera. */
export function holdSpan(hold: ArcHold): number {
  if (!Number.isFinite(hold.start) || !Number.isFinite(hold.end)) return 0;
  const span = hold.end - hold.start;
  return span > 0 ? span : 0;
}

export function isWithinHold(scrollProgress: number, hold: ArcHold): boolean {
  if (holdSpan(hold) <= 0) return false;
  if (!Number.isFinite(scrollProgress)) return false;
  return scrollProgress > hold.start && scrollProgress < hold.end;
}

/**
 * Scroll range over which a section completely fills the viewport.
 *
 * The html layer is translated by the reader's progress through the content,
 * so a section owns the screen from the moment its top edge reaches the top of
 * the viewport until its bottom edge reaches the bottom.
 */
export function computeHoldRange(
  sectionTop: number,
  sectionHeight: number,
  contentHeight: number,
  viewportHeight: number
): ArcHold {
  const travel = contentHeight - viewportHeight;

  if (
    !Number.isFinite(sectionTop) ||
    !Number.isFinite(sectionHeight) ||
    !Number.isFinite(travel) ||
    travel <= 0 ||
    viewportHeight <= 0
  ) {
    return NO_HOLD;
  }

  // A section shorter than the viewport never fills it, so it never holds.
  if (sectionHeight <= viewportHeight) return NO_HOLD;

  const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

  const start = clamp01(sectionTop / travel);
  const end = clamp01((sectionTop + sectionHeight - viewportHeight) / travel);

  return end > start ? { start, end } : NO_HOLD;
}
