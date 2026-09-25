import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('three');
});

describe("three's file cache", () => {
  it('bounds a wait on the cache by the waiter\'s own signal, leaving the import to others', async () => {
    // Round 12 (TECH-036): a model handoff waited on a pending import past its prefetch deadline.
    const { untilAborted } = await import('./threeCache');
    let resolve!: (value: number) => void;
    const shared = new Promise<number>(done => { resolve = done; });
    const controller = new AbortController();
    const waiting = untilAborted(shared, controller.signal);
    controller.abort(new Error('Model prefetch timed out'));
    await expect(waiting).rejects.toThrow('Model prefetch timed out');
    const other = untilAborted(shared, new AbortController().signal);
    resolve(7);
    await expect(other).resolves.toBe(7);
    await expect(untilAborted(Promise.resolve(3))).resolves.toBe(3);
    const done = new AbortController();
    done.abort(new Error('already over'));
    await expect(untilAborted(shared, done.signal)).rejects.toThrow('already over');
  });

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
