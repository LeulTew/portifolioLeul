import * as THREE from 'three';

/**
 * The assets the first view cannot open without, fetched up front with real
 * byte progress.
 *
 * The loader used to read drei's `useProgress`, which cannot drive a fill.
 * It counts items rather than bytes, so a 3.6MB island and a 20KB shore field
 * are one tick each; it rebases its percentage on every batch, so progress
 * jumps backwards as new work arrives; and it reports `active: false` both
 * before loading starts and between waves, which reads identically to being
 * finished. On a fast connection that is invisible. On a slow one -- the case
 * that matters -- the bar sits still and then the page opens onto a world
 * still streaming in behind it.
 *
 * Fetching the manifest here instead gives a percentage that is true: bytes
 * arrived over bytes expected, monotonic, and complete only when every file is
 * actually in hand. The scene's own loaders then find the models already in
 * three's cache and resolve without touching the network again.
 */

export type CriticalAssetKind = 'model' | 'texture';

export interface CriticalAsset {
  readonly url: string;
  /**
   * Size on disk, used to weight the fill before any response header arrives.
   *
   * Only a starting estimate: the real Content-Length replaces it as each
   * response opens, so the fill stays honest even if these drift.
   */
  readonly bytes: number;
  readonly kind: CriticalAssetKind;
}

/**
 * Everything the opening shot needs.
 *
 * Deliberately not the whole site: project images are lazy, and the CRT's
 * clips stream on their own. These are the files that decide whether the first
 * thing a visitor sees is the island or an empty sea.
 */
export const CRITICAL_ASSETS: readonly CriticalAsset[] = [
  { url: '/models/terrain-opt.glb', bytes: 3_757_380, kind: 'model' },
  { url: '/models/me-animated-lite.glb', bytes: 847_188, kind: 'model' },
  { url: '/models/crt-lite.glb', bytes: 392_744, kind: 'model' },
  { url: '/images/waternormals.jpg', bytes: 248_813, kind: 'texture' },
  { url: '/images/shore-field.png', bytes: 19_919, kind: 'texture' },
  { url: '/images/leul-profile.webp', bytes: 41_616, kind: 'texture' },
];

/** The models among the critical assets. */
export const CRITICAL_MODELS: readonly string[] = CRITICAL_ASSETS.filter(
  (asset) => asset.kind === 'model'
).map((asset) => asset.url);

/**
 * The textures the scene loads through three, so a readiness probe can wait on
 * exactly them.
 *
 * The hero portrait is prefetched with the rest but is an ordinary <img>, not
 * a three texture, so it is not something the scene can be asked to resolve.
 */
export const CRITICAL_SCENE_TEXTURES: readonly string[] = [
  '/images/waternormals.jpg',
  '/images/shore-field.png',
];

export interface AssetProgress {
  /** Bytes arrived so far. */
  readonly loadedBytes: number;
  /** Bytes expected, refined as each response header arrives. */
  readonly totalBytes: number;
  /** Share of the total, 0 to 1. Never goes backwards. */
  readonly ratio: number;
  /** Files finished, whether they arrived or failed. */
  readonly settled: number;
  readonly total: number;
  /** Files that could not be fetched. The scene loads them itself instead. */
  readonly failed: number;
}

export interface LoadCriticalAssetsOptions {
  readonly assets?: readonly CriticalAsset[];
  readonly signal?: AbortSignal;
  /** Injected in tests. Defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
}

/** 'glTF', the four bytes every binary glTF file starts with. */
const GLB_MAGIC = 0x46546c67;

/**
 * Rejects a response that is not the asset it was asked for.
 *
 * This deployment rewrites every unmatched path to index.html, so a model that
 * is missing or misnamed does not 404 -- it answers 200 with a page. Trusting
 * `response.ok` would put that HTML into three's cache as a model, and
 * GLTFLoader would fail on it with a parse error that says nothing about the
 * real problem. Better to treat it as a failed prefetch, which the scene
 * already knows how to recover from.
 */
function looksLikeHtml(contentType: string | null | undefined): boolean {
  return typeof contentType === 'string' && contentType.includes('text/html');
}

/** True when `buffer` opens with the binary glTF magic number. */
export function isBinaryGltf(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  return new DataView(buffer).getUint32(0, true) === GLB_MAGIC;
}

function emptyProgress(assets: readonly CriticalAsset[]): AssetProgress {
  return {
    loadedBytes: 0,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    ratio: 0,
    settled: 0,
    total: assets.length,
    failed: 0,
  };
}

interface SharedRun {
  promise: Promise<AssetProgress>;
  readonly subscribers: Set<(progress: AssetProgress) => void>;
  latest: AssetProgress;
}

/**
 * The one run of the manifest, shared by every caller.
 *
 * Without this the manifest is downloaded more than once: React's strict mode
 * mounts effects twice, and any remount of the loader starts again. Measured
 * in the browser, the island was being requested three times -- which on the
 * slow connection this whole path exists for is three times the wait.
 *
 * A caller that goes away unsubscribes; it never cancels the download, because
 * the bytes are still wanted by the scene that is about to ask for them.
 */
let shared: SharedRun | null = null;

/** Test-only: forget the shared run so each case starts from nothing. */
export function resetCriticalAssets(): void {
  shared = null;
}

export function loadCriticalAssets(
  onProgress: (progress: AssetProgress) => void,
  options: LoadCriticalAssetsOptions = {}
): Promise<AssetProgress> {
  const { assets, signal, fetchImpl } = options;

  // A caller supplying its own manifest or transport wants its own run.
  if (assets || fetchImpl) return runLoad(onProgress, options);

  if (!shared) {
    /*
     * Built before the load starts, and deliberately so: runLoad publishes its
     * opening state synchronously, before it has returned anything to assign.
     * Referring to the record from inside that callback reaches it before it
     * exists.
     */
    const run: SharedRun = {
      subscribers: new Set(),
      latest: emptyProgress(CRITICAL_ASSETS),
      promise: Promise.resolve(emptyProgress(CRITICAL_ASSETS)),
    };
    shared = run;

    run.promise = runLoad((progress) => {
      run.latest = progress;
      for (const subscriber of run.subscribers) subscriber(progress);
    });
  }

  const active = shared;
  active.subscribers.add(onProgress);
  onProgress(active.latest);

  if (signal) {
    signal.addEventListener('abort', () => active.subscribers.delete(onProgress), {
      once: true,
    });
  }

  return active.promise;
}

/**
 * Fetches every critical asset, reporting byte progress as they stream.
 *
 * Never rejects. A file that fails to prefetch is counted as settled and left
 * to the scene's own loader, which will report it through the usual Suspense
 * path -- a failed prefetch must not be able to trap a visitor on the loader.
 */
async function runLoad(
  onProgress: (progress: AssetProgress) => void,
  { assets = CRITICAL_ASSETS, signal, fetchImpl }: LoadCriticalAssetsOptions = {}
): Promise<AssetProgress> {
  const request = fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);

  if (!request || assets.length === 0) {
    const nothing = { ...emptyProgress(assets), ratio: 1, settled: assets.length };
    onProgress(nothing);
    return nothing;
  }

  // Seeded so the models are handed straight to GLTFLoader rather than being
  // asked for a second time. Without this the prefetch only warms the HTTP
  // cache, and a static host that answers with a revalidation instead of a
  // stored response makes the visitor wait for a round trip per model.
  THREE.Cache.enabled = true;

  const expected = assets.map((asset) => asset.bytes);
  const received = assets.map(() => 0);
  const done = assets.map(() => false);
  let failed = 0;

  /** Monotonic: a corrected Content-Length must never walk the fill back. */
  let highWaterRatio = 0;

  const publish = () => {
    const totalBytes = expected.reduce((sum, value) => sum + value, 0);
    const loadedBytes = received.reduce((sum, value) => sum + value, 0);
    const settled = done.filter(Boolean).length;

    const raw = totalBytes > 0 ? loadedBytes / totalBytes : settled / assets.length;
    highWaterRatio = Math.max(highWaterRatio, Math.min(raw, 1));

    onProgress({
      loadedBytes,
      totalBytes,
      ratio: settled === assets.length ? 1 : highWaterRatio,
      settled,
      total: assets.length,
      failed,
    });
  };

  publish();

  await Promise.all(
    assets.map(async (asset, index) => {
      try {
        const response = await request(asset.url, { signal });
        if (!response.ok) throw new Error(`${response.status} for ${asset.url}`);

        if (looksLikeHtml(response.headers?.get?.('content-type'))) {
          throw new Error(`${asset.url} answered with a page, not the asset`);
        }

        const declared = Number(response.headers?.get?.('content-length') ?? 0);
        if (Number.isFinite(declared) && declared > 0) {
          expected[index] = declared;
        }

        const body = response.body;

        if (body && typeof body.getReader === 'function') {
          const reader = body.getReader();
          const chunks: Uint8Array[] = [];

          for (;;) {
            const { done: finished, value } = await reader.read();
            if (finished) break;
            if (value) {
              chunks.push(value);
              received[index] += value.byteLength;
              publish();
            }
          }

          if (asset.kind === 'model') {
            const buffer = new Uint8Array(received[index]);
            let offset = 0;
            for (const chunk of chunks) {
              buffer.set(chunk, offset);
              offset += chunk.byteLength;
            }
            if (!isBinaryGltf(buffer.buffer)) {
              throw new Error(`${asset.url} is not a binary glTF`);
            }
            THREE.Cache.add(asset.url, buffer.buffer);
          }
        } else {
          // No streaming body: still correct, just one step instead of many.
          const buffer = await response.arrayBuffer();
          received[index] = buffer.byteLength;
          expected[index] = buffer.byteLength;
          if (asset.kind === 'model') {
            if (!isBinaryGltf(buffer)) {
              throw new Error(`${asset.url} is not a binary glTF`);
            }
            THREE.Cache.add(asset.url, buffer);
          }
        }
      } catch {
        // Counted as arrived so the fill completes; the scene's own loader
        // will try again and surface any real failure through Suspense.
        failed += 1;
        received[index] = expected[index];
      } finally {
        done[index] = true;
        publish();
      }
    })
  );

  const totalBytes = expected.reduce((sum, value) => sum + value, 0);
  const final: AssetProgress = {
    loadedBytes: received.reduce((sum, value) => sum + value, 0),
    totalBytes,
    ratio: 1,
    settled: assets.length,
    total: assets.length,
    failed,
  };

  onProgress(final);
  return final;
}

/**
 * Drops the prefetched model buffers.
 *
 * Call once the scene is up: by then GLTFLoader has parsed each one into
 * geometry and textures, and holding the source bytes as well is several
 * megabytes retained for nothing -- on exactly the machines this work is for.
 */
export function releaseCriticalAssets(
  assets: readonly CriticalAsset[] = CRITICAL_ASSETS
): void {
  for (const asset of assets) {
    if (asset.kind === 'model') THREE.Cache.remove(asset.url);
  }
}
