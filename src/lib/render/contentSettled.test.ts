import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CONTENT_QUIET_MS,
  isContentSettled,
  registerContent,
  resetContentSettled,
  setContentSettled,
  subscribeContentSettled,
  watchContentSettled,
} from './contentSettled';

describe('contentSettled', () => {
  beforeEach(() => resetContentSettled());
  afterEach(() => {
    resetContentSettled();
    vi.useRealTimers();
  });

  it('reports settled when no content has registered', () => {
    /*
     * The escape hatch that keeps a page with no DOM layer -- a unit test, a
     * caller that never mounts sections -- from hanging on the loader waiting
     * for a signal that is never coming. Mirrors `isSceneReady`.
     */
    expect(isContentSettled()).toBe(true);
  });

  it('reports unsettled once content registers, and settled once it announces', () => {
    registerContent();
    expect(isContentSettled()).toBe(false);

    setContentSettled();
    expect(isContentSettled()).toBe(true);
  });

  it('notifies subscribers on both registration and settlement', () => {
    const listener = vi.fn();
    subscribeContentSettled(listener);

    registerContent();
    expect(listener).toHaveBeenCalledTimes(1);

    setContentSettled();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    subscribeContentSettled(listener)();

    registerContent();
    expect(listener).not.toHaveBeenCalled();
  });

  it('settles only once, however many times it is told', () => {
    const listener = vi.fn();
    registerContent();
    subscribeContentSettled(listener);

    setContentSettled();
    setContentSettled();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('watchContentSettled', () => {
  beforeEach(() => {
    resetContentSettled();
    vi.useFakeTimers();
  });
  afterEach(() => {
    resetContentSettled();
    vi.useRealTimers();
  });

  it('holds the page shut until the content has been quiet', () => {
    const watcher = watchContentSettled();

    // Registered, so the loader now genuinely waits on it.
    expect(isContentSettled()).toBe(false);

    vi.advanceTimersByTime(CONTENT_QUIET_MS - 1);
    expect(isContentSettled()).toBe(false);

    vi.advanceTimersByTime(2);
    expect(isContentSettled()).toBe(true);

    watcher.stop();
  });

  it('restarts the quiet period every time the content moves', () => {
    /*
     * Images and the webfont land in a burst, each one changing the height.
     * Settling on the first pause between them would announce a layout that is
     * still two reflows from final.
     */
    const watcher = watchContentSettled();

    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(CONTENT_QUIET_MS - 10);
      watcher.poke();
      expect(isContentSettled()).toBe(false);
    }

    vi.advanceTimersByTime(CONTENT_QUIET_MS);
    expect(isContentSettled()).toBe(true);

    watcher.stop();
  });

  it('does not announce after being torn down', () => {
    const watcher = watchContentSettled();
    watcher.stop();

    vi.advanceTimersByTime(CONTENT_QUIET_MS * 4);

    // Registered but never settled: the grace period in the loader, not this,
    // is what stops that from trapping anyone.
    expect(isContentSettled()).toBe(false);
  });
});
