import type { Cache as ThreeCache } from 'three';

/**
 * Three's file cache, loaded only when a scene asset needs it.
 *
 * The prefetch hands models and textures to three's loaders through this
 * cache. The no-WebGL page prefetches only DOM media, so importing three here
 * statically put the whole graphics library on its startup path for nothing
 * (round 10, TECH-029). Every caller awaits the cache before a scene consumer
 * can read the entry: model consumers stay suspended until their transfer
 * settles, which happens after the add.
 */
let cache: Promise<typeof ThreeCache> | null = null;
let loaded: typeof ThreeCache | null = null;

/**
 * Waits for `promise`, or rejects with the signal's reason the moment it
 * aborts: a model handoff waiting on the cache stays inside its own prefetch
 * deadline, while the shared import itself runs on for other consumers
 * (round 12, TECH-036).
 */
export function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

export function threeCache(): Promise<typeof ThreeCache> {
  cache ??= import('three').then(three => {
    three.Cache.enabled = true;
    loaded = three.Cache;
    return three.Cache;
  });
  return cache;
}

/**
 * Drops an entry: at once if the cache is loaded, which it is for anything ever
 * added, after the load if one is under way, and not at all if three was never
 * asked for -- nothing can be in a cache that was never enabled, and asking
 * would download three on a page that cannot draw.
 */
export function removeFromThreeCache(url: string): void {
  if (loaded) loaded.remove(url);
  else void cache?.then(entries => entries.remove(url));
}
