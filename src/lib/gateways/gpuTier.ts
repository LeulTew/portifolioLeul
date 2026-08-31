/**
 * Hardware Capability & GPU Tier Detector
 * Automatically tunes WebGL fidelity, particle counts, and shader quality for 60fps.
 */

export interface GpuTierConfig {
  tier: 'low' | 'medium' | 'high';
  dpr: [number, number];
  particleCount: number;
  enablePostProcessing: boolean;
  enableComplexShaders: boolean;
  shadowMapSize: number;
  /**
   * Redraw ceiling for the 3D layer, in frames per second. Zero means every
   * frame the browser offers.
   *
   * Only the backdrop is capped. The DOM layer -- the copy the reader is
   * actually scrolling -- is never throttled, so the page still scrolls at the
   * display's rate while the world behind it redraws less often.
   */
  maxFps: number;
  /**
   * Resolution of the water's reflection render target.
   *
   * The ocean renders the whole scene a second time into this target every
   * drawn frame, so it is the single most expensive thing on the page after
   * the scene itself. Halving the edge quarters that cost, and the result is
   * a reflection that was already being distorted by the normal map.
   */
  waterReflectionSize: number;
  /**
   * Whether the device can afford backdrop-filter blurs.
   *
   * A backdrop blur forces the compositor to read back and blur everything
   * behind the element on every frame it moves, and this page stacks them --
   * cards, panels, the full-viewport scrim -- over a live WebGL canvas.
   */
  enableBackdropBlur: boolean;
}

export function detectGpuTier(): GpuTierConfig {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      tier: 'medium',
      dpr: [1, 1.5],
      particleCount: 800,
      enablePostProcessing: false,
      enableComplexShaders: true,
      shadowMapSize: 1024,
      maxFps: 0,
      waterReflectionSize: 512,
      enableBackdropBlur: true,
    };
  }

  // Device memory and CPU cores heuristics
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const isMobileOrTablet = /Mobi|Tablet|iPad/i.test(navigator.userAgent);

  // WebGL Renderer check
  let isLowPowerGpu = false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        if (/intel|mali|adreno(?!.*(660|730|740))|powervr/i.test(renderer)) {
          isLowPowerGpu = true;
        }
      }
    }
  } catch {
    // Canvas context probe fallback
  }

  if (isMobileOrTablet || memory < 4 || cores <= 4 || isLowPowerGpu) {
    return {
      tier: 'low',
      dpr: [1, 1],
      particleCount: 350,
      enablePostProcessing: false,
      enableComplexShaders: false,
      shadowMapSize: 512,
      // Half rate for the backdrop only. The camera arc is damped on elapsed
      // time rather than frame count, so it sits in exactly the same place on
      // the frames that are drawn.
      maxFps: 30,
      waterReflectionSize: 256,
      enableBackdropBlur: false,
    };
  }

  if (memory >= 8 && cores >= 8 && !isLowPowerGpu) {
    return {
      tier: 'high',
      dpr: [1, 2],
      particleCount: 1500,
      enablePostProcessing: true,
      enableComplexShaders: true,
      shadowMapSize: 2048,
      maxFps: 0,
      waterReflectionSize: 512,
      enableBackdropBlur: true,
    };
  }

  return {
    tier: 'medium',
    dpr: [1, 1.5],
    particleCount: 800,
    enablePostProcessing: false,
    enableComplexShaders: true,
    shadowMapSize: 1024,
    maxFps: 0,
    waterReflectionSize: 512,
    enableBackdropBlur: true,
  };
}

/**
 * Detected once per document.
 *
 * Detection probes for a WebGL context to read the renderer string, so each
 * call allocates a canvas and a GL context. Nothing it measures can change
 * while the page is open, and it previously ran twice on mount -- once for the
 * initial state and once from an effect that then re-rendered the whole app
 * with an identical value.
 */
let cached: GpuTierConfig | null = null;

export function getGpuTier(): GpuTierConfig {
  if (!cached) cached = detectGpuTier();
  return cached;
}

/** Test-only: drop the memoized reading so detection runs again. */
export function resetGpuTier(): void {
  cached = null;
}

export function useGpuTier(): GpuTierConfig {
  // Deliberately not state: the value is fixed for the life of the document,
  // so there is nothing to subscribe to and nothing to re-render for.
  return getGpuTier();
}
