import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCENE_GRACE_MS } from '@/components/loader/useAssetLoadingProgress';
import {
  beginWorldCompile,
  isSceneReady,
  isWorldHeld,
  registerScene,
  resetSceneReady,
  setSceneReady,
  setWorldCompiled,
  subscribeSceneReady,
  WORLD_COMPILE_MS,
  WORLD_HOLD_MS,
} from './sceneReady';

describe('sceneReady', () => {
  beforeEach(() => resetSceneReady());
  afterEach(() => resetSceneReady());

  it('counts as ready when no scene is coming at all', () => {
    /*
     * A page with no Canvas -- a DOM test, or a browser without WebGL -- has
     * no world to wait for. Reporting "not ready" there would hold the loader
     * shut on a signal that is never going to arrive.
     */
    expect(isSceneReady()).toBe(true);
  });

  it('holds once a scene announces itself, until it says otherwise', () => {
    registerScene();
    expect(isSceneReady()).toBe(false);

    setSceneReady();
    expect(isSceneReady()).toBe(true);
  });

  it('treats readiness as registration, whatever the order', () => {
    // The probe registers before it suspends, but a scene that never got that
    // far and reports ready directly must still count.
    setSceneReady();
    expect(isSceneReady()).toBe(true);
  });

  it('tells subscribers when the world arrives', () => {
    const listener = vi.fn();
    subscribeSceneReady(listener);

    registerScene();
    expect(listener).toHaveBeenCalledTimes(1);

    setSceneReady();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('says nothing twice for the same transition', () => {
    const listener = vi.fn();
    subscribeSceneReady(listener);

    registerScene();
    registerScene();
    setSceneReady();
    setSceneReady();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops telling a subscriber that has unsubscribed', () => {
    const listener = vi.fn();
    const stop = subscribeSceneReady(listener);
    stop();

    registerScene();
    setSceneReady();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('the world held for its opening programs (round 31)', () => {
  beforeEach(() => resetSceneReady());
  afterEach(() => { resetSceneReady(); vi.restoreAllMocks(); });

  it('holds nothing when no world is coming', () => {
    expect(isWorldHeld()).toBe(false);
  });

  it('holds a registered world until its programs are compiled', () => {
    registerScene();
    expect(isWorldHeld()).toBe(true);
    beginWorldCompile();
    expect(isWorldHeld()).toBe(true);
    setWorldCompiled();
    expect(isWorldHeld()).toBe(false);
  });

  it('never holds a world that has reported itself up', () => {
    registerScene();
    setSceneReady();
    expect(isWorldHeld()).toBe(false);
  });

  it('lets a world draw that waited its whole allowance for resources', () => {
    const start = performance.now();
    registerScene();
    vi.spyOn(performance, 'now').mockReturnValue(start + WORLD_HOLD_MS - 1);
    expect(isWorldHeld()).toBe(true);
    vi.spyOn(performance, 'now').mockReturnValue(start + WORLD_HOLD_MS + 1);
    expect(isWorldHeld()).toBe(false);
  });

  it('gives compiling its own shorter allowance, from when it began', () => {
    const start = performance.now();
    registerScene();
    vi.spyOn(performance, 'now').mockReturnValue(start + 20_000);
    beginWorldCompile();
    vi.spyOn(performance, 'now').mockReturnValue(start + 20_000 + WORLD_COMPILE_MS - 1);
    expect(isWorldHeld()).toBe(true);
    vi.spyOn(performance, 'now').mockReturnValue(start + 20_000 + WORLD_COMPILE_MS + 1);
    expect(isWorldHeld()).toBe(false);
  });

  it('keeps the loader the longer wait: compiling gives up before it opens on its own', () => {
    // The loader opens the page this long after the last byte, whatever the scene says.
    expect(WORLD_COMPILE_MS).toBeLessThan(SCENE_GRACE_MS);
  });
});
