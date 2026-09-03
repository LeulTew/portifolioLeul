/**
 * Whether this browser will give us a WebGL context at all.
 *
 * Asked before the Canvas is mounted rather than discovered by it failing.
 * Every section of this page is rendered inside drei's `Scroll html`, which
 * lives inside the Canvas -- so a browser that refuses a context does not lose
 * the island, it loses the entire site. That is what an error boundary around
 * the Canvas was catching: a blank page with "something went wrong" on it, for
 * a reader whose browser is working exactly as configured.
 *
 * Firefox reports "WebGL is currently disabled" for a handful of ordinary
 * reasons -- hardware acceleration turned off, `webgl.disabled` set, a
 * hardened or privacy-focused profile, a blocklisted driver -- and none of
 * them are faults to be recovered from. They are a capability this page has to
 * ask about and then do without.
 *
 * Asked once and remembered. Probing costs a real context, and a page that
 * asked per component would allocate several and leak them.
 */

let answer: boolean | null = null;

function probe(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      // Old Safari and some embedded browsers only answer to this name.
      canvas.getContext('experimental-webgl');

    if (!context) return false;

    /*
     * Handed back deliberately. A probe that keeps its context holds one of
     * the handful the browser will give a document, and the Canvas we are
     * about to mount needs one of them.
     */
    const lose =
      'getExtension' in context
        ? (context as WebGLRenderingContext).getExtension('WEBGL_lose_context')
        : null;
    lose?.loseContext();

    return true;
  } catch {
    // Creation itself can throw rather than return null.
    return false;
  }
}

/** True when a WebGL context can be created. Probed once, then remembered. */
export function isWebGLAvailable(): boolean {
  if (answer === null) answer = probe();
  return answer;
}

/** Test-only: forget the probe so the next call asks again. */
export function resetWebGLSupport(): void {
  answer = null;
}
