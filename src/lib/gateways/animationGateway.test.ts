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

  it('updates state reactively via usePrefersReducedMotion hook', () => {
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

    // Simulate OS preference change
    if (listener) {
      act(() => {
        (listener as (e: { matches: boolean }) => void)({ matches: true });
      });
      expect(result.current).toBe(true);
    }

    unmount();
  });
});
