import { useState, useEffect, useRef } from 'react';
import { DOM_CRITICAL_ASSETS, loadCriticalAssets, type AssetProgress } from '@/lib/assets/criticalAssets';
import { isSceneReady, subscribeSceneReady } from '@/lib/render/sceneReady';
import { isContentSettled, subscribeContentSettled } from '@/lib/render/contentSettled';

/**
 * Drives the fill, and decides when the page is allowed to open.
 *
 * Two rules, and the whole loader follows from them.
 *
 * The fill is the download. It tracks bytes arrived over bytes expected, so on
 * a slow connection the letters fill slowly and honestly, and on a fast one
 * they fill fast -- rather than tracking a timer that happens to look right on
 * the machine it was tuned on.
 *
 * The page opens when the fill is finished, and not before. Not on a timer, not
 * when a loading manager happens to report itself idle between batches. The
 * previous version could satisfy its completion test before a single byte had
 * been requested, which is how a slow connection ended up looking at a finished
 * page with an empty world still streaming in behind it.
 */

export interface AssetLoadingState {
  /** Fill percentage, 0 to 100. Never goes backwards. */
  progress: number;
  /** Share of critical bytes that have actually arrived, 0 to 100. */
  rawProgress: number;
  isReady: boolean;
  /** True while bytes are still outstanding. */
  active: boolean;
  loaded: number;
  total: number;
  /** Critical assets that failed to prefetch. The scene retries them itself. */
  failed: number;
  statusMessage: string;
}

interface UseAssetLoadingProgressOptions {
  /**
   * Shortest the fill may take, in milliseconds.
   *
   * A floor, not a schedule. From a warm cache everything is in hand almost
   * immediately, and letters that snap from empty to full read as a glitch
   * rather than as a load.
   */
  minDurationMs?: number;
  onComplete?: () => void;
  /**
   * Whether a 3D scene will consume the critical models and textures. Without
   * WebGL nothing would, so only the DOM's own critical assets are fetched.
   */
  scene?: boolean;
}

/** How quickly the drawn fill chases the real one. Per frame, at 60fps. */
const FILL_EASING = 0.12;

/** Below this the fill is treated as arrived, so it cannot creep forever. */
const FILL_EPSILON = 0.4;

/**
 * Where the fill waits while the world and the page finish assembling.
 *
 * Downloading the models is most of the wait but not all of it: they still
 * have to be decoded and their shaders compiled, which on a weak GPU is a
 * visible pause -- and the DOM layer in front of them has its own settling to
 * do. Holding just short of full means the last sliver of the letters fills as
 * the page actually arrives, rather than the loader pulling away from a scene
 * and a layout that are both still putting themselves together.
 */
const SCENE_PENDING_CEILING = 0.97;

/**
 * How long the fill will wait on the scene and the layout after the bytes are
 * all in.
 *
 * Waiting for the world to finish building is a refinement, and a refinement
 * must not be able to hold the page shut. The download is the part that takes
 * real time and is genuinely tracked; compiling what arrived and laying out
 * the copy over it is a moment on top of it. If those signals do not come -- a
 * scene that failed to mount, a render loop the browser has parked because the
 * tab is in the background, a `document.fonts` that never resolves -- the page
 * opens anyway rather than leaving someone in front of letters that are almost,
 * but never quite, full.
 *
 * This was four seconds, which was not a grace period so much as a second
 * deadline: compiling the ocean's shaders and laying out five sections of copy
 * over them can exceed it on integrated graphics, and every time it did the
 * loader opened onto exactly the half-built page it exists to hide. Well past
 * any real build now, and still comfortably inside `LOADER_FAILSAFE_MS`.
 */
const SCENE_GRACE_MS = 10_000;

export function useAssetLoadingProgress(
  options: UseAssetLoadingProgressOptions = {}
): AssetLoadingState {
  const { minDurationMs = 1400, onComplete, scene = true } = options;

  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [assets, setAssets] = useState<AssetProgress | null>(null);

  /*
   * Held in refs, and deliberately not in the effect's dependencies.
   *
   * The fill loop must run uninterrupted for the life of the loader. Listing
   * the callback or the live byte count as dependencies tore the loop down and
   * rebuilt it on every frame, cancelling the frame it had just requested.
   */
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const assetRatioRef = useRef(0);
  const pendingAssetsRef = useRef<AssetProgress | null>(null);
  const completedRef = useRef(false);
  const sceneReadyRef = useRef(isSceneReady());
  const contentSettledRef = useRef(isContentSettled());
  /** When the last byte landed, and the grace period started. */
  const bytesInAtRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    loadCriticalAssets(
      (progress) => {
        assetRatioRef.current = progress.ratio;
        if (progress.ratio >= 1 && bytesInAtRef.current === null) {
          bytesInAtRef.current = Date.now();
        }
        pendingAssetsRef.current = progress;
      },
      scene ? { signal: controller.signal } : { signal: controller.signal, assets: DOM_CRITICAL_ASSETS }
    );

    return () => controller.abort();
  }, [scene]);

  useEffect(() => {
    sceneReadyRef.current = isSceneReady();
    return subscribeSceneReady(() => {
      sceneReadyRef.current = isSceneReady();
    });
  }, []);

  useEffect(() => {
    contentSettledRef.current = isContentSettled();
    return subscribeContentSettled(() => {
      contentSettledRef.current = isContentSettled();
    });
  }, []);

  useEffect(() => {
    const start = Date.now();
    let frame: number | null = null;

    const tick = () => {
      const elapsed = Date.now() - start;
      // Several streaming chunks may arrive between paints. They still count
      // immediately, but React only needs their latest snapshot once per RAF.
      if (pendingAssetsRef.current) {
        setAssets(pendingAssetsRef.current);
        pendingAssetsRef.current = null;
      }

      // The fill is the download, paced so it always reads as a fill, and
      // held just short of full until both the world behind it and the page in
      // front of it are up -- but only for as long as it is reasonable to wait
      // for that.
      const waitedForScene =
        bytesInAtRef.current !== null && Date.now() - bytesInAtRef.current >= SCENE_GRACE_MS;
      const pageIsUp = sceneReadyRef.current && contentSettledRef.current;
      const ceiling = pageIsUp || waitedForScene ? 1 : SCENE_PENDING_CEILING;
      const target =
        Math.min(assetRatioRef.current, elapsed / minDurationMs, ceiling) * 100;

      setDisplayedProgress((previous) => {
        const next = previous + (target - previous) * FILL_EASING;
        const settled = assetRatioRef.current >= 1 &&
          target >= 100 - FILL_EPSILON && next >= 100 - FILL_EPSILON;
        const value = settled ? 100 : Math.min(next, 100 - FILL_EPSILON);

        if (value >= 100 && !completedRef.current) {
          completedRef.current = true;
          // Deferred: this runs inside a state updater, and React must not be
          // asked to start another render from the middle of one.
          queueMicrotask(() => {
            setIsReady(true);
            completeRef.current?.();
          });
        }

        return value;
      });

      if (!completedRef.current) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [minDurationMs]);

  return {
    progress: displayedProgress,
    rawProgress: (assets?.ratio ?? 0) * 100,
    isReady,
    active: assets ? assets.settled < assets.total : true,
    loaded: assets?.settled ?? 0,
    total: assets?.total ?? 0,
    failed: assets?.failed ?? 0,
    statusMessage: getStatusMessage(displayedProgress),
  };
}

function getStatusMessage(value: number): string {
  if (value < 25) return 'INITIALIZING_GRAPHICS_PIPELINE';
  if (value < 55) return 'DECODING_3D_MESHES_AND_BUFFERS';
  if (value < 85) return 'COMPILING_GLSL_WATER_SHADERS';
  if (value < 100) return 'OPTIMIZING_GPU_VRAM_BUFFERS';
  return 'SYSTEM_READY_STANDBY_ONLINE';
}
