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
    let finished = false;
    const finish = (decoded: boolean) => {
      if (finished) return;
      finished = true;
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      URL.revokeObjectURL(objectUrl);
      if (!decoded) {
        image.src = '';
        resolve(false);
        return;
      }
      void cached.then(cache => {
        cache.add(url, image);
        resolve(true);
      }, () => resolve(false));
    };
    const abort = () => finish(false);
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().then(() => finish(true), () => finish(false));
      else finish(true);
    };
    image.onerror = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });
    image.src = objectUrl;
  });
}
