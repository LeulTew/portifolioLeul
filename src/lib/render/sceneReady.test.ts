import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSceneReady,
  registerScene,
  resetSceneReady,
  setSceneReady,
  subscribeSceneReady,
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
