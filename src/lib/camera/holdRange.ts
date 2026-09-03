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

/**
 * The scroll spans during which the camera does not advance.
 *
 * More than one, because more than one section holds the reader still: the
 * hero holds while it hands over, and About holds while it is read. A single
 * slot was enough while only About did it, and the moment the hero was given a
 * hold as well the camera flew through it -- the arc is mapped onto a fixed
 * fraction of total page scroll, so scroll that was not subtracted was scroll
 * that moved the viewpoint.
 */
export type ArcHolds = readonly ArcHold[];

export const NO_HOLDS: ArcHolds = [];

/** True while the scroll sits inside any of `holds`. */
export function isWithinAnyHold(scrollProgress: number, holds: ArcHolds): boolean {
  for (const hold of holds) {
    if (isWithinHold(scrollProgress, hold)) return true;
  }
  return false;
}

/**
 * Whether the camera is being held still at `scrollProgress`.
 *
 * Inclusive of a hold's start, which is why this is not `isWithinAnyHold`: the
 * hero's hold begins at zero, so a test that excluded its start would leave
 * the viewpoint free at the top of the page and then snap it the moment the
 * first wheel tick landed. Everything a freeze suppresses -- the arc, the
 * pointer drift -- has to be suppressed from the first frame.
 */
export function isCameraFrozen(scrollProgress: number, holds: ArcHolds): boolean {
  if (!Number.isFinite(scrollProgress)) return false;

  for (const hold of holds) {
    if (holdSpan(hold) <= 0) continue;
    if (scrollProgress >= hold.start && scrollProgress < hold.end) return true;
  }
  return false;
}

/**
 * Total held scroll strictly before `scrollProgress`.
 *
 * A hold the reader has passed contributes its whole span; the one they are
 * inside contributes only the part already spent, which is what keeps the
 * camera still rather than letting it creep across the hold.
 */
export function frozenBefore(scrollProgress: number, holds: ArcHolds): number {
  if (!Number.isFinite(scrollProgress) || scrollProgress <= 0) return 0;

  let frozen = 0;
  for (const hold of holds) {
    const span = holdSpan(hold);
    if (span <= 0) continue;

    if (scrollProgress >= hold.end) {
      frozen += span;
    } else if (scrollProgress > hold.start) {
      frozen += scrollProgress - hold.start;
    }
  }
  return frozen;
}

/** Total scroll the holds account for, however they are ordered. */
export function totalHeldSpan(holds: ArcHolds): number {
  let total = 0;
  for (const hold of holds) total += holdSpan(hold);
  return total;
}
