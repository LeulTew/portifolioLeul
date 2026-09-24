/**
 * WebGL contexts created only to ask the GPU a question, then given back.
 *
 * Firefox allows eight live contexts per principal and silently evicts the
 * least recently used -- here, the backdrop -- rather than refusing a new one,
 * and it reclaims a document's contexts slowly across reloads. Leaked probes
 * therefore accumulate until the world behind the sections disappears.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=790138
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1501142
 */

type AnyGL = WebGLRenderingContext | WebGL2RenderingContext;

/** Newest first; `experimental-webgl` remains for old Safari and embedded browsers. */
const CONTEXT_NAMES = ['webgl2', 'webgl', 'experimental-webgl'] as const;

/**
 * The first context offered, from a fresh canvas per name: a canvas already set
 * to one type returns null for the others, which would report a WebGL 1-only
 * browser (common with blocklisted drivers) as having no WebGL at all.
 * The caller must pass the result to {@link releaseContext}.
 */
export function acquireProbeContext(): AnyGL | null {
  if (typeof document === 'undefined') return null;

  for (const name of CONTEXT_NAMES) {
    try {
      const context = document.createElement('canvas').getContext(name);
      if (context) return context as AnyGL;
    } catch {
      // Creation can throw rather than return null; try the next name.
    }
  }

  return null;
}

/** Frees the live-context slot now; a dropped reference keeps it taken until loss. */
export function releaseContext(context: AnyGL | null): void {
  if (!context) return;

  try {
    context.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // The extension is absent, or the context is already gone.
  }
}