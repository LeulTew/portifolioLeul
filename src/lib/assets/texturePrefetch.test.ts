import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Cache, TextureLoader } from 'three';
import { cacheTextureBytes } from './texturePrefetch';

const url = '/images/waternormals.jpg';
let images: HTMLImageElement[] = [];
const revoke = vi.fn<(url: string) => void>();

beforeEach(() => {
  Cache.enabled = true;
  images = [];
  revoke.mockReset();
  const NativeURL = globalThis.URL;
  class TestURL extends NativeURL {
    static createObjectURL = vi.fn(() => 'blob:owned-texture-bytes');
    static revokeObjectURL = revoke;
  }
  vi.stubGlobal('URL', TestURL);
  vi.stubGlobal('Image', class {
    src = '';
    decoding = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decode = vi.fn(async () => {});
    constructor() { images.push(this as unknown as HTMLImageElement); }
  });
});
afterEach(() => {
  Cache.remove(url);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('decoded texture prefetch ownership', () => {
  it('hands the original decoded image to ImageLoader, with no second URL fetch', async () => {
    const pending = cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg');
    expect(images[0].src).toBe('blob:owned-texture-bytes');
    images[0].onload!(new Event('load'));
    expect(await pending).toBe(true);
    expect(Cache.get(url)).toBe(images[0]);
    expect(images[0].decode).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:owned-texture-bytes');
    const createImage = vi.spyOn(document, 'createElementNS');
    const texture = await new TextureLoader().loadAsync(url);
    expect(texture.image).toBe(images[0]);
    expect(createImage).not.toHaveBeenCalled();
    texture.dispose();
  });

  it('releases a rejected decode without poisoning the loader cache', async () => {
    const pending = cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg');
    vi.mocked(images[0].decode).mockRejectedValueOnce(new Error('invalid image'));
    images[0].onload!(new Event('load'));
    expect(await pending).toBe(false);
    expect(Cache.get(url)).toBeUndefined();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('always revokes a failed image and leaves ImageLoader free to retry', async () => {
    const pending = cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg');
    images[0].onerror!(new Event('error'));
    expect(await pending).toBe(false);
    expect(Cache.get(url)).toBeUndefined();
    expect(revoke).toHaveBeenCalledOnce();
    expect(images[0].src).toBe('');
  });

  it('releases aborted image work without caching a late decode', async () => {
    const controller = new AbortController();
    const pending = cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg', controller.signal);
    let decoded!: () => void;
    vi.mocked(images[0].decode).mockImplementation(() => new Promise<void>(resolve => { decoded = resolve; }));
    images[0].onload!(new Event('load'));
    controller.abort();
    expect(await pending).toBe(false);
    decoded();
    await Promise.resolve();
    expect(Cache.get(url)).toBeUndefined();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('keeps an abort that lands after the decode, before the cache is ready, from publishing', async () => {
    // Round 12 (TECH-037): cancellation was released at decode, and the image was cached later anyway.
    vi.resetModules();
    let release!: () => void;
    vi.doMock('./threeCache', async () => {
      const actual = await vi.importActual<typeof import('./threeCache')>('./threeCache');
      const gate = new Promise<void>(resolve => { release = resolve; });
      return { ...actual, threeCache: () => gate.then(() => Cache) };
    });
    try {
      const { cacheTextureBytes: late } = await import('./texturePrefetch');
      const controller = new AbortController();
      const pending = late(url, new ArrayBuffer(8), 'image/jpeg', controller.signal);
      images[0].onload!(new Event('load'));
      await Promise.resolve();
      await Promise.resolve();
      controller.abort();
      expect(await pending).toBe(false);
      release();
      await Promise.resolve();
      await Promise.resolve();
      expect(Cache.get(url)).toBeUndefined();
      expect(images[0].src).toBe('');
    } finally {
      vi.doUnmock('./threeCache');
      vi.resetModules();
    }
  });

  it('does not create images when cancelled before subscribing or when the response is not an image', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg', controller.signal)).toBe(false);
    expect(await cacheTextureBytes(url, new ArrayBuffer(8), 'text/html')).toBe(false);
    expect(await cacheTextureBytes(url, new ArrayBuffer(8), null)).toBe(false);
    expect(images).toHaveLength(0);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('falls back to the normal ImageLoader when native object URLs are unavailable', async () => {
    Object.defineProperty(URL, 'createObjectURL', { value: undefined });
    expect(await cacheTextureBytes(url, new ArrayBuffer(8), 'image/jpeg')).toBe(false);
    expect(images).toHaveLength(0);
  });
});
