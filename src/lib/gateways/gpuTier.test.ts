import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectGpuTier, resetGpuTier, useGpuTier } from './gpuTier';

describe('GPU Tier Detection Gateway', () => {
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('detects high-tier configuration for high-spec desktop devices', () => {
    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        hardwareConcurrency: 16,
        deviceMemory: 16,
      },
      configurable: true,
      writable: true,
    });

    const tier = detectGpuTier();
    expect(tier.tier).toBe('high');
    expect(tier.dpr).toEqual([1, 2]);
    expect(tier.particleCount).toBe(1500);
    expect(tier.enableComplexShaders).toBe(true);
  });

  it('detects low-tier configuration for mobile or low-memory devices', () => {
    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        hardwareConcurrency: 4,
        deviceMemory: 2,
      },
      configurable: true,
      writable: true,
    });

    const tier = detectGpuTier();
    expect(tier.tier).toBe('low');
    expect(tier.dpr).toEqual([1, 1]);
    expect(tier.particleCount).toBe(350);
    expect(tier.enableComplexShaders).toBe(false);
  });

  it('useGpuTier React hook returns detected tier config', () => {
    const { result } = renderHook(() => useGpuTier());
    expect(result.current).toHaveProperty('tier');
    expect(result.current).toHaveProperty('dpr');
    expect(result.current).toHaveProperty('particleCount');
  });
});

/**
 * The renderer probe is the only reason this module touches the GPU, and the
 * context it takes to do so is one of the eight Firefox allows a principal.
 * Holding it for the life of the document is what pushed the backdrop out.
 */
describe('GPU tier renderer probe', () => {
  beforeEach(() => resetGpuTier());

  afterEach(() => {
    vi.restoreAllMocks();
    resetGpuTier();
  });

  const stubProbe = (context: unknown) => {
    vi.spyOn(document, 'createElement').mockImplementation(
      () => ({ getContext: () => context }) as unknown as HTMLCanvasElement
    );
  };

  it('hands the renderer probe context back', () => {
    const loseContext = vi.fn();
    stubProbe({
      getExtension: (ext: string) =>
        ext === 'WEBGL_lose_context' ? { loseContext } : null,
      getParameter: () => '',
    });

    detectGpuTier();

    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('hands the context back even when reading the renderer throws', () => {
    const loseContext = vi.fn();
    stubProbe({
      getExtension: (ext: string) => {
        if (ext === 'WEBGL_lose_context') return { loseContext };
        // Firefox masks the debug renderer info unless it is turned on, and a
        // resisted-fingerprinting profile never reports one.
        throw new Error('debug renderer info is masked');
      },
      getParameter: () => '',
    });

    expect(() => detectGpuTier()).not.toThrow();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('still reports a tier when the browser refuses a context', () => {
    stubProbe(null);

    expect(['low', 'medium', 'high']).toContain(detectGpuTier().tier);
  });
});
