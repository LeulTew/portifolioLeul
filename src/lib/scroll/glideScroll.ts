import { easeInOutCubic } from '@/lib/motion/triggeredPhase';
import { forgetHeldScroll, isScrollHeld, ownScroll, subscribeScrollbarPress } from './scrollGesture';

/**
 * Scrolls a container to a position, smoothly, without asking the browser to
 * do the smoothing.
 *
 * `scrollTo({ behavior: 'smooth' })` does not work on this page's scrollport
 * and never did: the container belongs to drei's `ScrollControls`, which writes
 * `scrollTop` itself on every frame to drive its damping. Any script assignment
 * to `scrollTop` cancels an in-flight native smooth scroll, so the animation
 * was being killed on the frame after it started and the reader never moved --
 * every navigation link was inert, while a plain instant assignment to
 * `scrollTop` worked perfectly.
 *
 * So the easing is done here, one `scrollTop` write per frame, which is the one
 * kind of scrolling that container tolerates.
 *
 * The glide yields to the reader: any real scroll input abandons it where it
 * is rather than fighting the hand for the rest of the duration.
 */

/** Long enough to read as travel, short enough not to feel like a wait. */
export const GLIDE_MS = 900;

export interface GlideOptions {
  durationMs?: number;
  /** Injected in tests. */
  now?: () => number;
}

export interface Glide {
  /** Stops the glide where it is. */
  cancel(): void;
}

/** Input that means the reader has taken over. */
const INTERRUPTS = ['wheel', 'touchstart', 'keydown'] as const;

export function glideScrollTo(
  container: HTMLElement,
  top: number,
  { durationMs = GLIDE_MS, now = () => performance.now() }: GlideOptions = {}
): Glide {
  const from = container.scrollTop;
  const max = Math.max(container.scrollHeight - container.clientHeight, 0);
  const to = Math.min(Math.max(top, 0), max);
  const distance = to - from;

  let frame = 0;
  let done = false;
  let stopPress: (() => void) | null = null;
  // One key for all this glide's frames: a newer frame replaces a held one, and stopping forgets it (round 27, TECH-075).
  const key = {};
  /** The last frame's write, while it still waits for a held thumb: the glide is not over until it runs. */
  let landing = false;

  const detach = () => {
    stopPress?.();
    stopPress = null;
    for (const type of INTERRUPTS) {
      window.removeEventListener(type, stop, { capture: true } as EventListenerOptions);
    }
  };
  const stop = () => {
    // A timer that ran out under a held thumb has not landed yet: cancelling or the reader's own
    // input still retires the write it left (round 28, TECH-078).
    if (landing) {
      landing = false;
      forgetHeldScroll(key);
      detach();
      return;
    }
    if (done) return;
    done = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    forgetHeldScroll(key);
    detach();
  };

  // Nothing to travel: still tidy up the listeners we never added.
  if (distance === 0 || durationMs <= 0) {
    ownScroll(() => { container.scrollTop = to; });
    done = true;
    return { cancel: () => {} };
  }

  for (const type of INTERRUPTS) {
    window.addEventListener(type, stop, { passive: true, capture: true });
  }
  // A press on a scrollbar is the reader taking the page too (round 26, TECH-073).
  stopPress = subscribeScrollbarPress(stop);

  const start = now();

  const step = () => {
    frame = 0;
    if (done) return;

    const elapsed = now() - start;
    const t = Math.min(1, Math.max(0, elapsed / durationMs));
    const at = from + distance * easeInOutCubic(t);
    const last = t >= 1;
    ownScroll(() => {
      container.scrollTop = at;
      if (last && landing) {
        landing = false;
        detach();
      }
    }, { key });

    if (last) {
      done = true;
      // Written already, or waiting for the thumb: until it runs, the glide can still be retired.
      if (!isScrollHeld()) detach();
      else landing = true;
      return;
    }
    frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);

  return { cancel: stop };
}
