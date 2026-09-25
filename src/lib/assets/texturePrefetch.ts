import { threeCache } from './threeCache';

/**
 * ImageLoader's cache needs a decoded image, not an ArrayBuffer. Decode the
 * bytes already downloaded instead of making it fetch and decode them again.
 * The cached image has the same flip/color semantics as TextureLoader's image.
 * Unknown response types retain the existing HTTP-cache/ImageLoader fallback.
 */
export async function cacheTextureBytes(
  url: string,
  buffer: ArrayBuffer,
  contentType: string | null,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted || typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function' ||
      !contentType?.toLowerCase().startsWith('image/')) return false;

  // Loaded alongside the decode; the entry is added before this resolves.
  const cached = threeCache();
  const image = new Image();
  image.decoding = 'async';
  const objectUrl = URL.createObjectURL(new Blob([buffer], { type: contentType }));
  return new Promise<boolean>(resolve => {
    let settled = false;
    // Cancellation owns the texture until it is published, not only until it decodes: an
    // abort while the cache is still loading must not let the image in later (round 12, TECH-037).
    const settle = (published: boolean) => {
      if (settled) return;
      settled = true;
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      URL.revokeObjectURL(objectUrl);
      if (!published) image.src = '';
      resolve(published);
    };
    const abort = () => settle(false);
    const publish = () => {
      void cached.then(cache => {
        if (settled || signal?.aborted) {
          settle(false);
          return;
        }
        cache.add(url, image);
        settle(true);
      }, () => settle(false));
    };
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(publish, () => settle(false));
      else publish();
    };
    image.onerror = () => settle(false);
    signal?.addEventListener('abort', abort, { once: true });
    image.src = objectUrl;
  });
}
