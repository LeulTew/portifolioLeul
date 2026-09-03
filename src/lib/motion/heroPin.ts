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
 * A third of a screen, down from 1.35.
 *
 * This one number decides three things at once, which is why it kept being
 * the answer. The hero is `1 + hold` screens tall, so the section underneath
 * cannot start climbing until the hold is spent: the hold IS how long the
 * reader waits for it. The mark begins partway through the hold and ends above
 * About's heading, so the hold is also most of the mark's length. Holding for
 * 1.35 screens meant waiting most of a page for the panel and drawing the mark
 * down an empty hero while waiting.
 *
 * Short enough that the panel is on its way up almost as soon as the mark
 * starts, and still long enough for the copy to leave and the plate to close
 * as two separate beats.
 */
export const HERO_HOLD_SCREENS = 0.35;

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
   * The mark starts under the plate as the plate begins to shut.
   *
   * The plate is pinned, so `plateBottom` is where it sits on the screen for
   * the whole hold rather than where it sits in the page; the page position
   * that lines up with it is the scroll at which drawing begins plus that
   * offset.
   *
   * It was moved to the end of the hold at one point to stop it being drawn
   * down an empty hero. That was the wrong lever: the fix is for the section
   * underneath to arrive sooner, which is the hold's length, not the mark's
   * timing.
   */
  const top = holdLength * INNER_END + plateBottom + CUE_START_GAP;

  /*
   * The head lands `CUE_TIP_GAP` above the heading at the moment the held
   * stretch takes over the window, which is the earliest the heading can be
   * shown at all.
   */
  const bottom = heldTop + Math.max(heading - CUE_TIP_GAP, 0);

  return bottom > top ? { top, height: bottom - top } : blank;
}

/**
 * How far through its drawing the cue is.
 *
 * Nothing while the copy is still leaving -- a line inviting the reader onward
 * competes with the thing it leads them away from. Then it is drawn evenly,
 * from the moment the plate starts to shut through to the moment the held
 * stretch takes over the window, where its head comes to rest just above the
 * heading.
 *
 * One even span, not three phases. It was timed against the plate's close and
 * then made to track the bottom edge of the window, which drew the whole line
 * before the section it points at existed on screen.
 */
export function cueDraw(
  sectionTop: number,
  holdLength: number,
  heldTop: number
): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(holdLength)) return 0;
  if (!Number.isFinite(heldTop) || holdLength < 0) return 0;

  const startsAt = holdLength * INNER_END;
  const span = heldTop - startsAt;
  if (span <= 0) return 0;

  const scrolled = Math.max(-sectionTop, 0);
  return clamp01((scrolled - startsAt) / span);
}

/**
 * Screens of scroll the finished mark keeps its place before it goes.
 *
 * Once the head is at rest above the heading, that composition is the point of
 * the whole handover -- so it is held rather than scrolled away. The mark used
 * to be carried off the top the moment About settled, which meant the one
 * frame everything had been built for was the frame it disappeared on.
 *
 * Matched to when About's own copy arrives: the statements begin a fourteenth
 * of the held stretch in, which at three screens is this much scroll.
 */
export const CUE_REST_SCREENS = 0.14;

/** Screens of scroll the mark takes to leave, once the copy has its turn. */
export const CUE_FADE_SCREENS = 0.09;

/**
 * How far to push the finished mark down so it keeps its place on screen.
 *
 * Zero until the head is at rest, then exactly what has been scrolled since --
 * which cancels out and reads as held -- and then no more, so it is released
 * and carried away with the page as the copy takes over.
 */
export function cueRest(
  sectionTop: number,
  heldTop: number,
  viewportHeight: number
): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(heldTop)) return 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;

  const past = Math.max(-sectionTop, 0) - heldTop;
  if (past <= 0) return 0;

  const limit = viewportHeight * (CUE_REST_SCREENS + CUE_FADE_SCREENS);
  return Math.min(past, limit);
}

/**
 * How present the mark is, 1 down to 0.
 *
 * Full while it is being drawn and while it rests, then eased away over the
 * stretch where About's own copy arrives -- so the two exchange places instead
 * of the mark simply vanishing.
 */
export function cuePresence(
  sectionTop: number,
  heldTop: number,
  viewportHeight: number
): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(heldTop)) return 1;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 1;

  const past = Math.max(-sectionTop, 0) - heldTop;
  const rest = viewportHeight * CUE_REST_SCREENS;
  const fade = viewportHeight * CUE_FADE_SCREENS;
  if (past <= rest || fade <= 0) return 1;

  const through = clamp01((past - rest) / fade);
  // Smoothstep: it eases out of rest rather than starting to go abruptly.
  return 1 - through * through * (3 - 2 * through);
}
