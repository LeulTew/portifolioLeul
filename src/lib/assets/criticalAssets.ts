import { getGpuTier } from '@/lib/gateways/gpuTier';
import terrainBake from '@/lib/scene/terrain-outline-bake.json';
import { AssetBuffer } from './assetBuffer';
import { cacheTextureBytes } from './texturePrefetch';
import { removeFromThreeCache as removeFromCache, threeCache, untilAborted } from './threeCache';

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
 * actually in hand. Completed model buffers are handed to Three's cache.
 * Requests still use an awaited native stream: r161's FileLoader does not
 * forward midstream reader failures or release its stalled in-flight entry.
 * Only the model consumers wait for their own prefetch to settle. Cameras,
 * layout, textures and unrelated models do not wait for the whole manifest.
 */

/**
 * `model` hands its complete, validated buffer to GLTFLoader through Three's cache.
 * `texture` is decoded into ImageLoader's cache for three's TextureLoader.
 * `media` is neither: it is fetched only so the fill accounts for it and so the
 * browser has it in the HTTP cache by the time an element asks for it.
 */
export type CriticalAssetKind = 'model' | 'texture' | 'media';

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
 * Project images are lazy. The CRT now starts genuinely off, so its optional
 * broadcast loads only after the visitor presses its physical power switch.
 * No video belongs to scene readiness or can delay the visible Hero reveal.
 */
export const CRITICAL_ASSETS: readonly CriticalAsset[] = [
  { url: '/models/terrain-opt.glb', bytes: terrainBake.variants[0].bytes, kind: 'model' },
  { url: '/models/me-animated-lite.glb', bytes: 847_188, kind: 'model' },
  { url: '/images/waternormals.jpg', bytes: 248_813, kind: 'texture' },
  { url: '/images/shore-field.png', bytes: terrainBake.shore.bytes, kind: 'texture' },
  { url: '/images/leul-portrait.webp', bytes: 19_544, kind: 'media' },
];

/** The models among the critical assets. */
export const CRITICAL_MODELS: readonly string[] = CRITICAL_ASSETS.filter(
  (asset) => asset.kind === 'model'
).map((asset) => asset.url);

/** What the page itself paints before it opens; all a page without WebGL waits for. */
export const DOM_CRITICAL_ASSETS: readonly CriticalAsset[] = CRITICAL_ASSETS.filter(
  (asset) => asset.kind === 'media'
);

const SOFTWARE_MODELS: Readonly<Record<string, CriticalAsset>> = {
  '/models/terrain-opt.glb': { url: '/models/terrain-software.glb', bytes: terrainBake.variants[1].bytes, kind: 'model' },
  '/models/me-animated-lite.glb': { url: '/models/me-animated-software.glb', bytes: 336_260, kind: 'model' },
};
const SOFTWARE_ASSETS = CRITICAL_ASSETS.map(asset => SOFTWARE_MODELS[asset.url] ?? asset);
const SOFTWARE_CRITICAL_MODELS = SOFTWARE_ASSETS.filter(asset => asset.kind === 'model').map(asset => asset.url);

export function resolveSceneModel(url: string, software = getGpuTier().softwareRenderer): string {
  return software ? SOFTWARE_MODELS[url]?.url ?? url : url;
}

export function getCriticalAssets(software = getGpuTier().softwareRenderer): readonly CriticalAsset[] {
  return software ? SOFTWARE_ASSETS : CRITICAL_ASSETS;
}

export function getCriticalModels(software = getGpuTier().softwareRenderer): readonly string[] {
  return software ? SOFTWARE_CRITICAL_MODELS : CRITICAL_MODELS;
}

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

/** Cancel the optional transfer before App's independent 45-second failsafe. */
export const MODEL_PREFETCH_TIMEOUT_MS = 30_000;

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

/** Reject the HTML fallback some static hosts return with a successful status. */
export function isBinaryGltf(buffer: ArrayBuffer): boolean {
  return buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, true) === 0x46546c67;
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
  readModel(url: string): void;
  modelReady(url: string): void;
  releaseModels(assets: readonly CriticalAsset[]): void;
}

interface ModelTransfer {
  promise: Promise<void>;
  settle(): void;
  settled: boolean;
  decoded: boolean;
  releaseRequested: boolean;
}

/**
 * One isolated native run and its model handoffs. The app shares a single
 * instance; an explicit manifest can exercise the same lifecycle independently.
 */
export function createCriticalAssetRun(options: LoadCriticalAssetsOptions = {}): SharedRun {
  const assets = options.assets ?? getCriticalAssets();
  const models = new Map<string, ModelTransfer>();
  let runError: unknown;
  for (const asset of assets) {
    if (asset.kind !== 'model') continue;
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const transfer: ModelTransfer = {
      promise,
      settle() {
        transfer.settled = true;
        resolve();
      },
      settled: false,
      decoded: false,
      releaseRequested: false,
    };
    models.set(asset.url, transfer);
  }
  const run: SharedRun = {
    subscribers: new Set(),
    latest: emptyProgress(assets),
    promise: Promise.resolve(emptyProgress(assets)),
    readModel(url) {
      if (runError) throw runError;
      const transfer = models.get(url);
      if (transfer && !transfer.settled) throw transfer.promise;
    },
    modelReady(url) {
      const transfer = models.get(url);
      if (!transfer) return;
      transfer.decoded = true;
      if (transfer.releaseRequested) removeFromCache(url);
    },
    releaseModels(requested) {
      for (const asset of requested) {
        if (asset.kind !== 'model') continue;
        const transfer = models.get(asset.url);
        if (transfer && !transfer.decoded) transfer.releaseRequested = true;
        else removeFromCache(asset.url);
      }
    },
  };
  run.promise = runLoad(progress => {
    run.latest = progress;
    for (const subscriber of run.subscribers) subscriber(progress);
  }, { ...options, assets }, asset => models.get(asset.url)?.settle());
  // No transport or an empty manifest takes the early-return path in runLoad.
  const settleRemaining = () => {
    for (const transfer of models.values()) transfer.settle();
  };
  void run.promise.then(settleRemaining, error => {
    runError = error;
    settleRemaining();
  });
  return run;
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

/** Suspend only a known model consumer, never its camera or HTML ancestors. */
export function readCriticalModel(url: string): void {
  if (!getCriticalModels().includes(url)) return;
  shared ??= createCriticalAssetRun();
  shared.readModel(url);
}

/** A committed child has resolved useGLTF's per-URL parsed cache entry. */
export function markCriticalModelReady(url: string): void {
  shared?.modelReady(url);
}

export function loadCriticalAssets(
  onProgress: (progress: AssetProgress) => void,
  options: LoadCriticalAssetsOptions = {}
): Promise<AssetProgress> {
  const { assets, signal, fetchImpl } = options;

  // A caller supplying its own manifest or transport wants its own run.
  if (assets || fetchImpl) return runLoad(onProgress, options);

  shared ??= createCriticalAssetRun();

  const active = shared;
  const unsubscribe = () => {
    active.subscribers.delete(onProgress);
    signal?.removeEventListener('abort', unsubscribe);
  };
  if (!signal?.aborted) {
    active.subscribers.add(onProgress);
    signal?.addEventListener('abort', unsubscribe, { once: true });
    onProgress(active.latest);
    void active.promise.then(unsubscribe, unsubscribe);
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
  { assets = getCriticalAssets(), signal, fetchImpl }: LoadCriticalAssetsOptions = {},
  onAssetSettled?: (asset: CriticalAsset) => void,
): Promise<AssetProgress> {
  const request = fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);

  if (assets.length === 0) {
    const nothing = { ...emptyProgress(assets), ratio: 1, settled: assets.length };
    onProgress(nothing);
    return nothing;
  }

  if (!request) {
    console.warn('Critical asset prefetch is unavailable: fetch is not supported. The scene loaders may retry.');
    const unavailable = { ...emptyProgress(assets), ratio: 1, settled: assets.length, failed: assets.length };
    onProgress(unavailable);
    return unavailable;
  }

  // A model that finishes prefetching before GLTFLoader asks for it can be
  // reused without another HTTP-cache revalidation. Loaded alongside the
  // downloads, never ahead of them, and not at all for DOM-only media.
  const cached = assets.some(asset => asset.kind === 'model') ? threeCache() : null;
  // Owned from the start: a model that fails before its handoff never awaits it (round 13, TECH-041).
  cached?.catch(() => {});

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
    highWaterRatio = Math.max(highWaterRatio, Math.min(raw, 1 - Number.EPSILON));

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
      const controller = asset.kind === 'model' ? new AbortController() : null;
      const abort = () => controller?.abort(signal?.reason);
      if (signal?.aborted) abort();
      else if (controller) signal?.addEventListener('abort', abort, { once: true });
      const timeout = controller ? setTimeout(() => {
        controller.abort(new DOMException(`Model prefetch timed out: ${asset.url}`, 'TimeoutError'));
      }, MODEL_PREFETCH_TIMEOUT_MS) : undefined;
      const requestSignal = controller?.signal ?? signal;
      try {
        const response = await request(asset.url, { signal: requestSignal });
        if (!response.ok) throw new Error(`${response.status} for ${asset.url}`);

        const contentType = response.headers?.get?.('content-type') ?? null;
        if (looksLikeHtml(contentType)) {
          throw new Error(`${asset.url} answered with a page, not the asset`);
        }

        const declared = Number(response.headers?.get?.('content-length') ?? 0);
        if (Number.isFinite(declared) && declared > 0) {
          expected[index] = declared;
        }

        const body = response.body;

        if (body && typeof body.getReader === 'function') {
          const reader = body.getReader();
          const bytes = asset.kind !== 'media' ? new AssetBuffer(expected[index]) : null;
          try {
            for (;;) {
              const { done: finished, value } = await reader.read();
              if (finished) break;
              if (value) {
                bytes?.append(value);
                received[index] += value.byteLength;
                publish();
              }
            }
          } finally {
            reader.releaseLock?.();
          }

          if (requestSignal?.aborted) throw requestSignal.reason;
          if (bytes && asset.kind === 'model') {
            const buffer = bytes.finish();
            if (!isBinaryGltf(buffer)) {
              throw new Error(`${asset.url} is not a binary glTF`);
            }
            const entries = await untilAborted(cached ?? threeCache(), requestSignal);
            // Past its deadline while the cache loaded: the run moves on without these bytes.
            if (requestSignal?.aborted) throw requestSignal.reason;
            entries.add(asset.url, buffer);
          } else if (bytes && asset.kind === 'texture') {
            await cacheTextureBytes(asset.url, bytes.finish(), contentType, signal);
          }
          expected[index] = received[index];
        } else {
          // No streaming body: still correct, just one step instead of many.
          const buffer = await response.arrayBuffer();
          if (requestSignal?.aborted) throw requestSignal.reason;
          received[index] = buffer.byteLength;
          expected[index] = buffer.byteLength;
          if (asset.kind === 'model') {
            if (!isBinaryGltf(buffer)) {
              throw new Error(`${asset.url} is not a binary glTF`);
            }
            const entries = await untilAborted(cached ?? threeCache(), requestSignal);
            // Past its deadline while the cache loaded: the run moves on without these bytes.
            if (requestSignal?.aborted) throw requestSignal.reason;
            entries.add(asset.url, buffer);
          } else if (asset.kind === 'texture') {
            await cacheTextureBytes(asset.url, buffer, contentType, signal);
          }
        }
      } catch (error) {
        // Counted as arrived so the fill completes; the scene's own loader
        // will try again and surface any real failure through Suspense.
        if (!signal?.aborted) console.warn(`Critical asset prefetch failed: ${asset.url}. The scene loader may retry.`, error);
        failed += 1;
        received[index] = expected[index];
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        if (controller) signal?.removeEventListener('abort', abort);
        done[index] = true;
        onAssetSettled?.(asset);
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
 * An early request is remembered, not applied until the model's gated subtree
 * commits with a parsed GLTF. This also covers a fast prefetch completing before
 * Canvas registers; App's "no scene yet" readiness must not discard those bytes.
 */
export function releaseCriticalAssets(
  assets: readonly CriticalAsset[] = getCriticalAssets()
): void {
  if (shared) {
    // App can request release before Canvas registers or during a suspended
    // commit. Keep each raw buffer until its own parsed consumer is committed.
    shared.releaseModels(assets);
    return;
  }
  for (const asset of assets) {
    if (asset.kind === 'model') removeFromCache(asset.url);
  }
}
