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
 * One and a bit: enough for the copy to leave, the plate to close and the cue
 * to be drawn without any of them being rushed, and no more -- past that the
 * hold stops reading as a held beat and starts reading as a stuck page.
 */
export const HERO_HOLD_SCREENS = 1.35;

/** Total height of the hero, in screens, including the one it occupies. */
export const HERO_SCREENS = 1 + HERO_HOLD_SCREENS;

/**
 * Share of the hold spent emptying the hero, and then shutting its plate.
 *
 * The copy goes first and the plate follows it, because the plate is the
 * ground the copy stood on -- closing it while the name is still on it would
 * pull the floor out from under something that has not left yet.
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
 * How far through its drawing the cue is, from hold progress.
 *
 * Nothing until the plate has shut, then drawn across what is left of the
 * hold -- and it stays drawn, because the hold has not ended yet. That is the
 * difference between a cue that points at the next section and one that is
 * carried off the top of the window as soon as it appears.
 */
export function holdCue(progress: number): number {
  const remaining = 1 - HOLD_CLOSE_END;
  if (remaining <= 0) return 1;
  return clamp01((clamp01(progress) - HOLD_CLOSE_END) / remaining);
}
