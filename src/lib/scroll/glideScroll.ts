import { easeInOutCubic } from '@/lib/motion/triggeredPhase';

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

  const stop = () => {
    if (done) return;
    done = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const type of INTERRUPTS) {
      window.removeEventListener(type, stop, { capture: true } as EventListenerOptions);
    }
  };

  // Nothing to travel: still tidy up the listeners we never added.
  if (distance === 0 || durationMs <= 0) {
    container.scrollTop = to;
    done = true;
    return { cancel: () => {} };
  }

  for (const type of INTERRUPTS) {
    window.addEventListener(type, stop, { passive: true, capture: true });
  }

  const start = now();

  const step = () => {
    frame = 0;
    if (done) return;

    const elapsed = now() - start;
    const t = Math.min(1, Math.max(0, elapsed / durationMs));
    container.scrollTop = from + distance * easeInOutCubic(t);

    if (t >= 1) {
      stop();
      return;
    }
    frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);

  return { cancel: stop };
}
