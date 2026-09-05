import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isWebGLAvailable, resetWebGLSupport } from './webglSupport';

describe('webglSupport', () => {
  beforeEach(() => resetWebGLSupport());

  afterEach(() => {
    vi.restoreAllMocks();
    resetWebGLSupport();
  });

  /**
   * A canvas per call, as the browser gives one: `getContext` answers only for
   * the type the canvas was first set to.
   */
  const withContext = (offers: (name: string) => unknown) =>
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      let claimed: string | null = null;
      return {
        getContext(name: string) {
          if (claimed !== null && claimed !== name) return null;
          const context = offers(name);
          if (context) claimed = name;
          return context;
        },
      } as unknown as HTMLCanvasElement;
    });

  it('reports available when the browser hands back a context', () => {
    withContext((name) => (name === 'webgl2' ? { getExtension: () => null } : null));
    expect(isWebGLAvailable()).toBe(true);
  });

  it('falls back through the older context names', () => {
    // Old Safari and some embedded browsers only answer to the last of these.
    withContext((name) =>
      name === 'experimental-webgl' ? { getExtension: () => null } : null
    );
    expect(isWebGLAvailable()).toBe(true);
  });

  it('finds WebGL 1 on a browser that refuses WebGL 2', () => {
    /*
     * The state this page kept mistaking for "no WebGL at all". A blocklisted
     * driver, or a profile with `webgl.enable-webgl2` off, has WebGL 1 and
     * nothing more -- and a canvas that has already been asked for `webgl2`
     * answers null to every later name, so the fallback has to start from a
     * fresh one.
     */
    withContext((name) => (name === 'webgl' ? { getExtension: () => null } : null));
    expect(isWebGLAvailable()).toBe(true);
  });

  it('reports unavailable when every context is refused', () => {
    /*
     * Firefox with hardware acceleration off, `webgl.disabled` set, or a
     * blocklisted driver. Not a fault to recover from -- a capability to do
     * without, which is only possible if it is asked about first.
     */
    withContext(() => null);
    expect(isWebGLAvailable()).toBe(false);
  });

  it('reports unavailable when creating the context throws', () => {
    withContext(() => {
      throw new Error('WebGL is currently disabled');
    });
    expect(isWebGLAvailable()).toBe(false);
  });

  it('hands the probe context back rather than holding it', () => {
    // Firefox allows a principal eight live contexts and, past that, loses the
    // least recently used one -- which on this page is the backdrop.
    const loseContext = vi.fn();
    withContext((name) =>
      name === 'webgl2'
        ? { getExtension: (ext: string) => (ext === 'WEBGL_lose_context' ? { loseContext } : null) }
        : null
    );

    expect(isWebGLAvailable()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });

  it('survives a browser with no lose-context extension', () => {
    withContext((name) => (name === 'webgl2' ? { getExtension: () => null } : null));
    expect(isWebGLAvailable()).toBe(true);
  });

  it('probes once and remembers, however often it is asked', () => {
    const create = withContext(() => ({ getExtension: () => null }));

    isWebGLAvailable();
    isWebGLAvailable();
    isWebGLAvailable();

    expect(create).toHaveBeenCalledTimes(1);
  });
});
