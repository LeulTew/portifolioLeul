/**
 * The hero holds still while the reader scrolls, and the scroll drives what
 * happens instead of moving the page.
 *
 * The hero used to be one screen tall and simply leave with the scroll, so
 * everything it did on the way out was a side effect of it being carried off
 * the top of the window. That is the wrong model: a hero should hand over
 * deliberately, and handing over takes time the reader has to be given.
 *
 * So the section is several screens tall and its contents are held at the
 * first of them. Scrolling advances a progress value rather than the copy's
 * position, and that value spends itself in order: the copy leaves, the plate
 * it stood on draws shut, and the cue is drawn and held pointing at what comes
 * next. Only then does the hold release and the next section rise.
 *
 * `position: sticky` cannot do this here. The page scrolls inside a
 * transformed element, which leaves sticky with no scrollport to stick to --
 * the same reason the About stretch is pinned with a portal. This pins with a
 * transform instead: the held block is pushed down by exactly as much as the
 * page has scrolled, which cancels out and reads as fixed, and costs one
 * composited transform rather than a reflow.
 */

/**
 * Screens of scroll the hero holds for, beyond the one it occupies.
 *
 * Four fifths of a screen: enough for the copy to leave and the plate to close
 * without either being rushed, and no more. It was 1.35, which held the reader
 * still after the hero had finished saying anything -- and every pixel of that
 * hold is a pixel the mark which follows has to span, so a long hold made a
 * long arrow. Shortening it brings the section underneath up sooner and
 * shortens the mark, which were asked for together because they are the same
 * number.
 */
export const HERO_HOLD_SCREENS = 0.8;

/** Total height of the hero, in screens, including the one it occupies. */
export const HERO_SCREENS = 1 + HERO_HOLD_SCREENS;

/**
 * Share of the hold by which the copy has finished leaving.
 *
 * The copy goes first and completely, and only then does the plate move. The
 * two used to overlap -- the plate began shutting while the portrait was still
 * on its way out -- which reads as the floor being pulled from under something
 * that has not left yet. Sequential is the whole point of holding the reader
 * still: there is time to do one thing and then the other.
 */
export const INNER_END = 0.42;

/**
 * Share of the hold by which the plate has finished shutting.
 *
 * Leaves the rest to the cue, which is drawn across the close and carries on
 * after it.
 */
export const HOLD_CLOSE_END = 0.72;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * How far the reader has scrolled into the hold, in pixels.
 *
 * `sectionTop` is the section's own `top` from a bounding rect: zero when its
 * top edge meets the top of the window, and negative once past it.
 */
export function scrolledIntoHold(sectionTop: number, holdLength: number): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(holdLength)) return 0;
  if (holdLength <= 0) return 0;
  return Math.min(Math.max(-sectionTop, 0), holdLength);
}

/**
 * How far to push the held block down so it appears to stand still.
 *
 * Exactly what has been scrolled, for as long as the hold lasts, and then no
 * more -- so the block is released and carried away by the page like anything
 * else once its turn is over.
 */
export function pinOffset(sectionTop: number, holdLength: number): number {
  return scrolledIntoHold(sectionTop, holdLength);
}

/** Progress through the hold, 0 to 1. */
export function holdProgress(sectionTop: number, holdLength: number): number {
  if (holdLength <= 0) return 0;
  return clamp01(scrolledIntoHold(sectionTop, holdLength) / holdLength);
}

/**
 * The exit the hero's layers and plate read, from hold progress.
 *
 * Reaches one before the hold does, leaving the last stretch to the cue. The
 * copy and the plate are finished with well before the reader is handed on.
 */
export function holdExit(progress: number): number {
  if (HOLD_CLOSE_END <= 0) return 1;
  return clamp01(clamp01(progress) / HOLD_CLOSE_END);
}

/**
 * How far through leaving the copy is, from hold progress.
 *
 * Reaches one at `INNER_END`, so every layer inside the plate is gone before
 * the plate itself is touched.
 */
export function innerExit(progress: number): number {
  if (INNER_END <= 0) return 1;
  return clamp01(clamp01(progress) / INNER_END);
}

/**
 * How far shut the plate is, from hold progress.
 *
 * Nothing until the copy has gone, then closed across the stretch that
 * follows. This is the beat that reads as the hero being put away: the inner
 * background that carried the name draws shut around where the name was.
 */
export function plateShut(progress: number): number {
  const room = HOLD_CLOSE_END - INNER_END;
  if (room <= 0) return clamp01(progress) >= HOLD_CLOSE_END ? 1 : 0;
  return clamp01((clamp01(progress) - INNER_END) / room);
}

/**
 * Air between the cue's head and the heading it points at.
 */
export const CUE_TIP_GAP = 36;

/**
 * Fallback for where About's heading sits, as a share of the viewport.
 *
 * Used only before the heading has been measured. It is pinned near the top of
 * the window while About is held, so its position is a real number to be read
 * off layout rather than guessed -- this is just somewhere sane to start.
 */
export const CUE_TIP_SCREEN_SHARE = 0.16;

/**
 * Gap between the bottom of the hero's plate and the top of the cue.
 *
 * The mark begins where the plate that held the copy ended, with just enough
 * air that it reads as starting below it rather than growing out of it.
 */
export const CUE_START_GAP = 12;

/**
 * The cue's span down the page, measured from the top of the hero section.
 *
 * Both ends are measurements rather than constants: it starts under the plate,
 * wherever the plate happens to end at this window size, and finishes just
 * above About's heading, wherever that happens to be pinned. That is what
 * makes it long -- it is as long as the gap it spans, which at a laptop window
 * is most of two thousand pixels, and it is travelled along rather than looked
 * at.
 *
 * Deliberately not pinned. A held mark can only ever be as long as the window;
 * a mark anchored to the page can be as long as the distance it bridges.
 */
export function cueRail(
  plateBottom: number,
  heldTop: number,
  headingTop: number,
  holdLength: number,
  viewportHeight: number
): { top: number; height: number } {
  const blank = { top: 0, height: 0 };
  if (!Number.isFinite(plateBottom) || !Number.isFinite(heldTop)) return blank;
  if (!Number.isFinite(holdLength) || holdLength < 0) return blank;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return blank;

  const heading =
    Number.isFinite(headingTop) && headingTop > 0
      ? headingTop
      : viewportHeight * CUE_TIP_SCREEN_SHARE;

  /*
   * The plate is pinned, so `plateBottom` is where it sits on the screen for
   * the whole hold -- not where it sits in the page. By the time the mark
   * starts being drawn the reader has already scrolled the length of the
   * copy's departure, so the page position that lines up with the plate's
   * bottom edge at that moment is that scroll plus that screen offset.
   *
   * Anchoring at the screen offset alone put the start of the line a whole
   * departure's worth of scroll too high: it began drawing from somewhere off
   * the top of the window instead of from just under the plate the reader was
   * watching close.
   */
  const drawStarts = holdLength * INNER_END;
  const top = drawStarts + plateBottom + CUE_START_GAP;

  /*
   * The head lands `CUE_TIP_GAP` above the heading at the moment the heading
   * actually appears -- which is when the held stretch takes over the window,
   * not when About's panel first reaches the top.
   *
   * Those are two different places, about a quarter of a screen apart, and
   * aiming at the wrong one is why the mark was carried off the top before the
   * words it was pointing at had faded in. The stretch's overlay is only drawn
   * once it covers the window, so the heading cannot be shown any earlier; the
   * mark has to reach that far to still be there when it is.
   */
  const bottom = heldTop + Math.max(heading - CUE_TIP_GAP, 0);

  return bottom > top ? { top, height: bottom - top } : blank;
}

/**
 * How far through its drawing the cue is.
 *
 * Three beats, in the order the reader sees them.
 *
 * Nothing at all while the copy is leaving: a line inviting the reader onward
 * competes with the thing it is leading them away from.
 *
 * Then it draws alongside the plate shutting, and it is timed so that the head
 * arrives at the bottom edge of the window exactly as the plate finishes --
 * the hero closes and the line is already off the screen ahead of the reader.
 *
 * Then the head simply tracks the bottom edge, which means the reader is
 * always drawing the next bit of it as they travel, until the whole rail is
 * down. After that it is complete, and the page carries it up so the head
 * comes to rest above About's heading.
 */
export function cueDraw(
  sectionTop: number,
  holdLength: number,
  rail: { top: number; height: number },
  viewportHeight: number
): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(holdLength)) return 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  if (holdLength <= 0 || rail.height <= 0) return 0;

  const scrolled = Math.max(-sectionTop, 0);
  const closeStart = holdLength * INNER_END;
  const closeEnd = holdLength * HOLD_CLOSE_END;

  /** Drawn length that puts the head on the bottom edge of the window. */
  const toBottomEdge = (at: number) =>
    clamp01((viewportHeight + at - rail.top) / rail.height);

  if (scrolled <= closeStart) return 0;
  if (scrolled >= closeEnd) return toBottomEdge(scrolled);
  if (closeEnd <= closeStart) return toBottomEdge(scrolled);

  const throughClose = (scrolled - closeStart) / (closeEnd - closeStart);
  return clamp01(throughClose * toBottomEdge(closeEnd));
}
