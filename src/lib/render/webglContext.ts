/**
 * A WebGL context asked for as a question, not drawn with.
 *
 * Two things on this page need to ask the GPU something before the real
 * canvas exists: whether a context can be had at all, and what renderer is
 * behind it. Both were creating their own context, in their own way, and one
 * of them never gave it back.
 *
 * That matters most in Firefox, which allows eight live contexts per
 * principal and, past that, silently loses the least recently used one rather
 * than refusing the new one. On this page the least recently used context is
 * the backdrop -- created first, at load -- so the reader keeps the whole site
 * (the sections are DOM, rendered through drei's `Scroll html`) and loses only
 * the world behind them. Firefox is also known not to reclaim a document's
 * contexts promptly across a reload, so leaked probes accumulate over a few
 * refreshes until they push the backdrop out. Chrome allows sixteen and
 * restores an evicted context, which is why this only ever showed up in
 * Firefox.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=790138
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1501142
 */

type AnyGL = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * The names to try, newest first.
 *
 * `experimental-webgl` is only still here for old Safari and some embedded
 * browsers; nothing current answers to it.
 */
const CONTEXT_NAMES = ['webgl2', 'webgl', 'experimental-webgl'] as const;

/**
 * Asks for a context, and hands back the first one offered.
 *
 * A fresh canvas per name, deliberately. `getContext` returns null for any
 * type that differs from the one a canvas has already been set to, so a
 * single canvas walked down this list can turn a browser that has WebGL 1 but
 * not WebGL 2 -- an ordinary state for a blocklisted driver -- into a browser
 * that reports no WebGL at all.
 *
 * The caller owns what comes back and must pass it to {@link releaseContext}.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
 */
export function acquireProbeContext(): AnyGL | null {
  if (typeof document === 'undefined') return null;

  for (const name of CONTEXT_NAMES) {
    try {
      // A canvas of its own, so a refusal cannot spoil the next attempt.
      const context = document.createElement('canvas').getContext(name);
      if (context) return context as AnyGL;
    } catch {
      // Creation can throw rather than return null. Try the next name.
    }
  }

  return null;
}

/**
 * Gives a probe context back to the browser rather than waiting for the
 * collector to notice.
 *
 * The count that matters is live contexts, not reachable ones, so dropping
 * the reference is not enough -- the slot stays taken until the context is
 * actually lost.
 */
export function releaseContext(context: AnyGL | null): void {
  if (!context) return;

  try {
    context.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Nothing to do: the extension is absent, or the context is already gone.
  }
}
