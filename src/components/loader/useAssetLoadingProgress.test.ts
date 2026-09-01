import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AssetProgress } from '@/lib/assets/criticalAssets';
import { registerScene, resetSceneReady, setSceneReady } from '@/lib/render/sceneReady';
import { useAssetLoadingProgress } from './useAssetLoadingProgress';

/** Lets each test drive the download by hand. */
let publish: ((progress: AssetProgress) => void) | null = null;
let resolveLoad: (() => void) | null = null;

vi.mock('@/lib/assets/criticalAssets', () => ({
  loadCriticalAssets: (onProgress: (progress: AssetProgress) => void) => {
    publish = onProgress;
    return new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });
  },
}));

const at = (ratio: number, settled = ratio >= 1 ? 3 : 1): AssetProgress => ({
  loadedBytes: Math.round(ratio * 1000),
  totalBytes: 1000,
  ratio,
  settled,
  total: 3,
  failed: 0,
});

/** Runs `frames` animation frames of the fill loop. */
const advance = (frames: number, msPerFrame = 16) =>
  act(() => {
    for (let i = 0; i < frames; i += 1) vi.advanceTimersByTime(msPerFrame);
  });

/**
 * Lets the queued microtask run.
 *
 * Completion is deferred out of the state updater that detects it, so the
 * ready flag lands a microtask later. Testing Library's `waitFor` polls on
 * real timers and would simply hang against the fake ones.
 */
const flush = () => act(async () => { await Promise.resolve(); });

describe('useAssetLoadingProgress', () => {
  beforeEach(() => {
    publish = null;
    resolveLoad = null;
    resetSceneReady();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resolveLoad?.();
    resetSceneReady();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts empty and not ready', () => {
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 1000 }));

    expect(result.current.progress).toBe(0);
    expect(result.current.isReady).toBe(false);
  });

  it('does not open the page before a single byte has arrived', () => {
    /*
     * The reported bug, pinned.
     *
     * The old completion test was satisfied by the loading manager reporting
     * itself idle, which it does before anything has been requested. Past the
     * minimum duration it declared itself finished with nothing downloaded,
     * and the page opened onto a world that was still streaming in.
     */
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 200, onComplete })
    );

    advance(120, 16);

    expect(result.current.isReady).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.progress).toBeLessThan(5);
  });

  it('holds the fill at what has actually downloaded', () => {
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 100 }));

    act(() => publish?.(at(0.4)));
    advance(90);

    // Eases toward 40 and stops there, however long it is given.
    expect(result.current.progress).toBeGreaterThan(35);
    expect(result.current.progress).toBeLessThanOrEqual(40.001);
    expect(result.current.isReady).toBe(false);
  });

  it('completes once every byte is in, and only then', async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 100, onComplete })
    );

    act(() => publish?.(at(0.85)));
    advance(90);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => publish?.(at(1)));
    advance(120);
    await flush();

    expect(result.current.isReady).toBe(true);
    expect(result.current.progress).toBe(100);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('never lets the fill outrun the minimum duration', () => {
    // Everything served from cache at once still has to read as a fill rather
    // than as a flash.
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 2000 }));

    act(() => publish?.(at(1)));
    advance(6, 16);

    expect(result.current.progress).toBeLessThan(20);
  });

  it('reaches exactly full rather than creeping toward it', async () => {
    // An eased value approaches its target asymptotically; the letters have to
    // actually finish filling.
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 50 }));

    act(() => publish?.(at(1)));
    advance(200);
    await flush();

    expect(result.current.progress).toBe(100);
  });

  it('completes once, however many frames follow', async () => {
    const onComplete = vi.fn();
    renderHook(() => useAssetLoadingProgress({ minDurationMs: 50, onComplete }));

    act(() => publish?.(at(1)));
    advance(300);
    await flush();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps filling across a changing callback identity', () => {
    /*
     * ModernTVLoader passes an inline arrow, so the callback is a new function
     * on every render, and the hook re-renders on every frame it advances.
     * Depending on it tore down the frame loop and cancelled the frame it had
     * just requested, which is why the fill sat at zero.
     */
    const { result, rerender } = renderHook(
      ({ tag }: { tag: number }) =>
        useAssetLoadingProgress({ minDurationMs: 100, onComplete: () => tag }),
      { initialProps: { tag: 0 } }
    );

    act(() => publish?.(at(0.6)));
    for (let i = 0; i < 40; i += 1) {
      advance(2);
      rerender({ tag: i + 1 });
    }

    expect(result.current.progress).toBeGreaterThan(30);
  });

  it('reports what is still outstanding', () => {
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 100 }));

    act(() => publish?.(at(0.5, 1)));
    expect(result.current.active).toBe(true);
    expect(result.current.loaded).toBe(1);
    expect(result.current.total).toBe(3);
    expect(result.current.rawProgress).toBe(50);

    act(() => publish?.(at(1, 3)));
    expect(result.current.active).toBe(false);
  });

  it('describes each stage of the load', () => {
    const { result } = renderHook(() => useAssetLoadingProgress({ minDurationMs: 100 }));

    expect(result.current.statusMessage).toBe('INITIALIZING_GRAPHICS_PIPELINE');

    act(() => publish?.(at(1)));
    advance(200);

    expect(result.current.statusMessage).toBe('SYSTEM_READY_STANDBY_ONLINE');
  });
});

describe('waiting for the world behind the loader', () => {
  beforeEach(() => {
    publish = null;
    resetSceneReady();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetSceneReady();
    vi.useRealTimers();
  });

  it('holds just short of full while the scene is still assembling', () => {
    /*
     * Having the bytes is not having the scene: the models still have to be
     * decoded and their shaders compiled. Opening on the last byte hands over
     * a page whose world is visibly still arriving.
     */
    registerScene();

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 50, onComplete })
    );

    act(() => publish?.(at(1)));
    advance(200);

    expect(result.current.progress).toBeGreaterThan(90);
    expect(result.current.progress).toBeLessThan(100);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('gives up waiting for a scene that never reports, rather than hanging', async () => {
    /*
     * The gate is a refinement on top of the download, and a refinement must
     * not be able to trap anyone. A scene that fails to mount, or a render
     * loop the browser has parked because the tab is in the background, must
     * not leave someone in front of letters that are almost, but never quite,
     * full.
     */
    registerScene();

    const onComplete = vi.fn();
    renderHook(() => useAssetLoadingProgress({ minDurationMs: 50, onComplete }));

    act(() => publish?.(at(1)));
    advance(60);
    expect(onComplete).not.toHaveBeenCalled();

    // Past the grace period, with the scene still silent.
    advance(400, 16);
    await act(async () => { await Promise.resolve(); });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fills the last sliver once the world is up', async () => {
    registerScene();

    const onComplete = vi.fn();
    renderHook(() => useAssetLoadingProgress({ minDurationMs: 50, onComplete }));

    act(() => publish?.(at(1)));
    advance(200);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => setSceneReady());
    advance(200);
    await act(async () => { await Promise.resolve(); });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
