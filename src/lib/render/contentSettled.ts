/**
 * Whether the page in front of the world has stopped moving yet.
 *
 * The companion to `sceneReady`, and it exists for the same reason: having the
 * bytes is not having a finished page. The sections used not to be mounted at
 * all until the loader's exit animation had already begun, so everything that
 * happens when they appear -- images decoding, the webfont swapping, `<main>`
 * being measured, `ScrollControls` rebuilding its track and resetting
 * scrollTop -- happened *through* a fading overlay. What a visitor saw was a
 * finished loader over a page still assembling itself, which is the thing
 * being reported.
 *
 * They are mounted from the first render now, and this is what keeps the
 * loader down over the settling rather than fading away across it.
 *
 * "Settled" means two things have both happened: the fonts the copy is set in
 * have resolved, and the content's own height has held still long enough that
 * the next measurement will be the final one.
 *
 * If nothing ever registers -- a DOM test, or any caller that never mounts a
 * page -- the loader does not wait for a signal that is never coming. Only
 * content that has announced itself can hold the page shut, and even then only
 * for the grace period in `useAssetLoadingProgress`.
 */

type Listener = () => void;

/** How long the content's height must hold still to count as final. */
export const CONTENT_QUIET_MS = 260;

let registered = false;
let settled = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Called as the content mounts, before it can possibly have settled. */
export function registerContent(): void {
  if (registered) return;
  registered = true;
  notify();
}

/** Called once the fonts are in and the content's height has stopped moving. */
export function setContentSettled(): void {
  if (settled) return;
  registered = true;
  settled = true;
  notify();
}

/**
 * True when the page is laid out, or when there is no page waiting to lay out.
 */
export function isContentSettled(): boolean {
  return settled || !registered;
}

export function subscribeContentSettled(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: forget that any content ever mounted. */
export function resetContentSettled(): void {
  registered = false;
  settled = false;
  listeners.clear();
}

export interface ContentSettleWatcher {
  /**
   * Called whenever the content's size changed, restarting the quiet period.
   *
   * Deliberately driven by the caller rather than by a `ResizeObserver` of its
   * own: the one place that mounts the sections is already observing `<main>`
   * to size the scroll track, and a second observer on the same node is both
   * redundant work on every layout change and a second source of truth about
   * when the page moved.
   */
  poke(): void;
  stop(): void;
}

/**
 * Announces settlement once the fonts are in and `poke` has not been called
 * for `CONTENT_QUIET_MS`.
 */
export function watchContentSettled(): ContentSettleWatcher {
  if (settled) return { poke: () => {}, stop: () => {} };

  registerContent();

  let fontsReady = typeof document === 'undefined' || !document.fonts;
  let quietTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const announce = () => {
    if (disposed || !fontsReady) return;
    setContentSettled();
  };

  const poke = () => {
    if (disposed) return;
    if (quietTimer) clearTimeout(quietTimer);
    quietTimer = setTimeout(announce, CONTENT_QUIET_MS);
  };

  if (!fontsReady && document.fonts) {
    document.fonts.ready
      .then(() => {
        fontsReady = true;
        poke();
      })
      .catch(() => {
        // A browser that cannot tell us is not a browser we make wait.
        fontsReady = true;
        poke();
      });
  }

  poke();

  return {
    poke,
    stop: () => {
      disposed = true;
      if (quietTimer) clearTimeout(quietTimer);
    },
  };
}
