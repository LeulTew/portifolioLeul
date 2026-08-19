import { useState, useEffect } from 'react';

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
    };
  }

  return {
    tier: 'medium',
    dpr: [1, 1.5],
    particleCount: 800,
    enablePostProcessing: false,
    enableComplexShaders: true,
    shadowMapSize: 1024,
  };
}

export function useGpuTier(): GpuTierConfig {
  const [tierConfig, setTierConfig] = useState<GpuTierConfig>(() => detectGpuTier());

  useEffect(() => {
    setTierConfig(detectGpuTier());
  }, []);

  return tierConfig;
}
