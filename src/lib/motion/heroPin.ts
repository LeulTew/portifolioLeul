/**
 * The hero holds while scroll advances its handover to About.
 *
 * The section is `HERO_SCREENS` tall and its contents are held at the first
 * screen. `position: sticky` has no scrollport inside the transformed scroll
 * container, so the held block is instead pushed down by exactly what has been
 * scrolled: one composited transform, no reflow.
 *
 * Scroll names the moment each beat starts; the beat's own duration paces it
 * (see `triggeredPhase`). The scrub functions below remain the reduced-motion
 * path and the shape the tests pin, independent of timing.
 */

import { advancePhase, type PhaseState } from './triggeredPhase';

/**
 * Screens of scroll held beyond the one the hero occupies. It is both how long
 * the reader waits for About to climb and most of the cue's length, so it stays
 * short while leaving room for the copy exit and plate close as separate beats.
 */
export const HERO_HOLD_SCREENS = 0.35;

/** Total height of the hero, in screens, including the one it occupies. */
export const HERO_SCREENS = 1 + HERO_HOLD_SCREENS;

/** Share of the hold by which the copy has left; also fixes the cue's rail origin. */
export const INNER_END = 0.42;

/** Share of the hold by which the plate has closed; the rest belongs to the cue. */
export const HOLD_CLOSE_END = 0.72;

/** Copy and fog share one exit; the stroke overlaps it and About waits for both. */
export const INNER_EXIT_MS = 900;
export const PLATE_CLOSE_MS = 900;
export const CUE_DRAW_MS = 950;

/** Commit the copy exit the moment the reader moves; the lower point lets it return. */
export const INNER_ENTER = 0.02;
export const INNER_RELEASE = 0.005;
export const CUE_ENTER = INNER_ENTER;

/**
 * Hold progress that commits the plate close, and the point that reopens it.
 * The close also requires the copy beat to have finished, so a slow frame
 * cannot shut the plate under copy that is still standing.
 */
export const PLATE_ENTER = INNER_END;
export const PLATE_RELEASE = 0.36;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Pixels scrolled into the hold; `sectionTop` is the section's bounding-rect top. */
export function scrolledIntoHold(sectionTop: number, holdLength: number): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(holdLength)) return 0;
  if (holdLength <= 0) return 0;
  return Math.min(Math.max(-sectionTop, 0), holdLength);
}

/** Cancels the scroll during the hold, then releases the block to the page. */
export function pinOffset(sectionTop: number, holdLength: number): number {
  return scrolledIntoHold(sectionTop, holdLength);
}

/** Progress through the hold, 0 to 1. */
export function holdProgress(sectionTop: number, holdLength: number): number {
  if (holdLength <= 0) return 0;
  return clamp01(scrolledIntoHold(sectionTop, holdLength) / holdLength);
}

/** Layer and plate exit; completes at `HOLD_CLOSE_END`, before the hold does. */
export function holdExit(progress: number): number {
  if (HOLD_CLOSE_END <= 0) return 1;
  return clamp01(clamp01(progress) / HOLD_CLOSE_END);
}

/** Reduced-motion copy exit; completes at `INNER_END`, before the plate moves. */
export function innerExit(progress: number): number {
  if (INNER_END <= 0) return 1;
  return clamp01(clamp01(progress) / INNER_END);
}

/**
 * Reduced-motion plate close across `INNER_END`..`HOLD_CLOSE_END`. Named for
 * the original close; the stylesheet now disperses the feathered plate instead.
 */
export function plateShut(progress: number): number {
  const room = HOLD_CLOSE_END - INNER_END;
  if (room <= 0) return clamp01(progress) >= HOLD_CLOSE_END ? 1 : 0;
  return clamp01((clamp01(progress) - INNER_END) / room);
}

/** Air between the cue's head and the heading it points at. */
export const CUE_TIP_GAP = 36;

/** Heading position, as a viewport share, until the pinned heading is measured. */
export const CUE_TIP_SCREEN_SHARE = 0.16;

/** Gap below the plate, so the mark starts beneath it rather than growing out of it. */
export const CUE_START_GAP = 12;

/**
 * The cue's span from the top of the hero section. Both ends are measured --
 * under the plate, and just above About's pinned heading -- and the rail is
 * anchored to the page, not pinned, so it can be as long as the gap it bridges
 * rather than one window.
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

  // Requesting the ink earlier must not lengthen the rail or lift its origin.
  const top = holdLength * INNER_END + plateBottom + CUE_START_GAP;
  // The head lands when the held stretch takes the window, the heading's earliest.
  const bottom = heldTop + Math.max(heading - CUE_TIP_GAP, 0);

  return bottom > top ? { top, height: bottom - top } : blank;
}

/** One even span from `CUE_ENTER` to the held stretch taking the window. */
export function cueDraw(
  sectionTop: number,
  holdLength: number,
  heldTop: number
): number {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(holdLength)) return 0;
  if (!Number.isFinite(heldTop) || holdLength < 0) return 0;

  const startsAt = holdLength * CUE_ENTER;
  const span = heldTop - startsAt;
  if (span <= 0) return 0;

  const scrolled = Math.max(-sectionTop, 0);
  return clamp01((scrolled - startsAt) / span);
}

/** A spent flick still draws visibly instead of jumping to its requested endpoint. */
export function advanceCue(state: PhaseState, requested: number, dtMs: number): PhaseState {
  const target = clamp01(requested);
  const next = advancePhase(state, target > state.t, dtMs, CUE_DRAW_MS);
  return { ...next, t: next.heading > 0 ? Math.min(next.t, target) : Math.max(next.t, target) };
}

export function cueTravel(railTop: number, heldTop: number, holdLength: number, drawn: number): number {
  const start = holdLength * CUE_ENTER;
  return railTop - start - (heldTop - start) * clamp01(drawn);
}

/** Screens the finished mark holds above the heading: the handover's resting frame. */
export const CUE_REST_SCREENS = 0.14;

/** Screens of scroll the mark takes to leave, once the copy has its turn. */
export const CUE_FADE_SCREENS = 0.09;

/** Zero until the head rests, then cancels the scroll until the mark is released. */
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

/** Full while drawn and resting, then eased out as About's copy arrives. */
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
  return 1 - through * through * (3 - 2 * through);
}