import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getPrefersReducedMotion,
  usePrefersReducedMotion,
  lerp,
  clamp,
  Springs,
  Easings,
} from './animationGateway';

describe('animationGateway', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('provides valid spring and easing configurations', () => {
    expect(Springs.snappy.stiffness).toBe(450);
    expect(Springs.smooth.stiffness).toBe(300);
    expect(Springs.gentle.stiffness).toBe(120);

    expect(Easings.easeOutCubic).toBeDefined();
    expect(Easings.easeInOutQuart).toBeDefined();
    expect(Easings.anticipate).toBeDefined();
  });

  it('calculates linear interpolation and clamp accurately', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0.25)).toBe(12.5);

    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('detects prefers-reduced-motion via getPrefersReducedMotion', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getPrefersReducedMotion()).toBe(true);
  });

  it('safely handles missing matchMedia or SSR in getPrefersReducedMotion', () => {
    // @ts-expect-error simulating legacy/SSR
    window.matchMedia = undefined;
    expect(getPrefersReducedMotion()).toBe(false);
  });

  it('updates state reactively via usePrefersReducedMotion with addEventListener', () => {
    let listener: ((e: { matches: boolean }) => void) | null = null;

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, callback: (e: { matches: boolean }) => void) => {
        if (event === 'change') listener = callback;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    if (listener) {
      act(() => {
        (listener as (e: { matches: boolean }) => void)({ matches: true });
      });
      expect(result.current).toBe(true);
    }

    unmount();
  });

  it('falls back to legacy addListener and removeListener when addEventListener is missing', () => {
    let legacyListener: ((e: { matches: boolean }) => void) | null = null;
    const removeListenerMock = vi.fn();

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn((callback: (e: { matches: boolean }) => void) => {
        legacyListener = callback;
      }),
      removeListener: removeListenerMock,
      addEventListener: undefined,
      removeEventListener: undefined,
      dispatchEvent: vi.fn(),
    }));

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    if (legacyListener) {
      act(() => {
        (legacyListener as (e: { matches: boolean }) => void)({ matches: true });
      });
      expect(result.current).toBe(true);
    }

    unmount();
    expect(removeListenerMock).toHaveBeenCalled();
  });
});
