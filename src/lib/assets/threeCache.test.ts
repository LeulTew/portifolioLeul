import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('three');
});

describe("three's file cache", () => {
  it('is loaded only when asked for, and removing from it never downloads three', async () => {
    // Round 10 (TECH-029): releasing the prefetch on the no-WebGL page imported three to empty an unused cache.
    const loads = vi.fn();
    vi.doMock('three', async () => {
      loads();
      return vi.importActual('three');
    });
    const { removeFromThreeCache, threeCache } = await import('./threeCache');
    removeFromThreeCache('/models/terrain-opt.glb');
    await Promise.resolve();
    expect(loads).not.toHaveBeenCalled();

    const cache = await threeCache();
    expect(loads).toHaveBeenCalledOnce();
    expect(cache.enabled).toBe(true);
    cache.add('/models/terrain-opt.glb', new ArrayBuffer(4));
    removeFromThreeCache('/models/terrain-opt.glb');
    expect(cache.get('/models/terrain-opt.glb')).toBeUndefined();
    await threeCache();
    expect(loads).toHaveBeenCalledOnce();
  });
});
