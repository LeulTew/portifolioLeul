import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isWebGLAvailable, resetWebGLSupport } from './webglSupport';

describe('webglSupport', () => {
  beforeEach(() => resetWebGLSupport());

  afterEach(() => {
    vi.restoreAllMocks();
    resetWebGLSupport();
  });

  const withContext = (
    getContext: (name: string) => unknown
  ) =>
    vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ getContext } as unknown as HTMLCanvasElement);

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
    // A browser gives a document only a handful of contexts, and the Canvas
    // this runs before needs one of them.
    const loseContext = vi.fn();
    withContext((name) =>
      name === 'webgl2'
        ? { getExtension: (ext: string) => (ext === 'WEBGL_lose_context' ? { loseContext } : null) }
        : null
    );

    expect(isWebGLAvailable()).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });

  it('probes once and remembers, however often it is asked', () => {
    const getContext = vi.fn(() => ({ getExtension: () => null }));
    const create = withContext(getContext as unknown as (n: string) => unknown);

    isWebGLAvailable();
    isWebGLAvailable();
    isWebGLAvailable();

    expect(create).toHaveBeenCalledTimes(1);
  });
});
