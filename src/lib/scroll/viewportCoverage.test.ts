import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { focusStrength, FULL_FOCUS_COVERAGE, useViewportCoverage } from './viewportCoverage';

describe('focusStrength', () => {
  it('is zero when the section is off screen', () => {
    expect(focusStrength(0, 1000)).toBe(0);
  });

  it('scales with how much of the viewport the section covers', () => {
    // Half of full coverage should read as half strength.
    expect(focusStrength(1000 * FULL_FOCUS_COVERAGE * 0.5, 1000)).toBeCloseTo(0.5, 5);
  });

  it('reaches full strength at the coverage threshold', () => {
    expect(focusStrength(1000 * FULL_FOCUS_COVERAGE, 1000)).toBe(1);
  });

  it('clamps rather than exceeding full strength', () => {
    expect(focusStrength(1000, 1000)).toBe(1);
  });

  it('reaches full strength for a section far taller than the viewport', () => {
    // The whole point of measuring viewport coverage instead of
    // intersectionRatio: a six-screen section fills the viewport completely
    // while its own intersection ratio never exceeds ~0.17.
    const viewport = 800;
    expect(focusStrength(viewport, viewport)).toBe(1);
  });

  it('is zero for a degenerate viewport', () => {
    expect(focusStrength(500, 0)).toBe(0);
    expect(focusStrength(500, -10)).toBe(0);
  });

  it('is zero for negative or non-finite coverage', () => {
    expect(focusStrength(-100, 1000)).toBe(0);
    expect(focusStrength(Number.NaN, 1000)).toBe(0);
    expect(focusStrength(100, Number.NaN)).toBe(0);
  });

  it('treats a zero threshold as always fully focused', () => {
    expect(focusStrength(1, 1000, 0)).toBe(1);
  });

  it('honours a custom coverage threshold', () => {
    expect(focusStrength(250, 1000, 0.25)).toBe(1);
    expect(focusStrength(125, 1000, 0.25)).toBeCloseTo(0.5, 5);
  });
});

describe('useViewportCoverage', () => {
  type ObserverCallback = (entries: unknown[]) => void;

  let capturedCallback: ObserverCallback | null = null;
  let observedTargets: Element[] = [];
  let disconnectSpy: ReturnType<typeof vi.fn>;
  const originalObserver = globalThis.IntersectionObserver;

  class FakeIntersectionObserver {
    constructor(callback: ObserverCallback) {
      capturedCallback = callback;
    }
    observe(el: Element) {
      observedTargets.push(el);
    }
    unobserve() {}
    disconnect() {
      disconnectSpy();
    }
    takeRecords() {
      return [];
    }
  }

  const VIEWPORT = 800;
  const entry = (visibleHeight: number, isIntersecting = visibleHeight > 0) => ({
    isIntersecting,
    intersectionRect: { height: visibleHeight },
    rootBounds: { height: VIEWPORT },
  });

  beforeEach(() => {
    capturedCallback = null;
    observedTargets = [];
    disconnectSpy = vi.fn();
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      originalObserver;
  });

  it('starts at zero before anything is observed', () => {
    const { result } = renderHook(() => useViewportCoverage(null));
    expect(result.current).toBe(0);
  });

  it('observes the element it is given', () => {
    const element = document.createElement('section');
    renderHook(() => useViewportCoverage(element));
    expect(observedTargets).toEqual([element]);
  });

  it('reports coverage as the section fills the viewport', () => {
    const element = document.createElement('section');
    const { result } = renderHook(() => useViewportCoverage(element));

    act(() => capturedCallback?.([entry(VIEWPORT)]));
    expect(result.current).toBe(1);
  });

  it('never leaves a fully covering section at its starting value', () => {
    // Regression: driven by framer-motion's useScroll, this page's sections sat
    // permanently at their t=0 transform, because the viewport never scrolls.
    const element = document.createElement('section');
    const { result } = renderHook(() => useViewportCoverage(element));

    act(() => capturedCallback?.([entry(VIEWPORT)]));

    const opacity = 0.35 + result.current * 0.65;
    expect(opacity).toBeCloseTo(1, 5);
  });

  it('returns to zero when the section leaves', () => {
    const element = document.createElement('section');
    const { result } = renderHook(() => useViewportCoverage(element));

    act(() => capturedCallback?.([entry(VIEWPORT)]));
    act(() => capturedCallback?.([entry(0, false)]));

    expect(result.current).toBe(0);
  });

  it('disconnects on unmount', () => {
    const element = document.createElement('section');
    const { unmount } = renderHook(() => useViewportCoverage(element));
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('stays inert when IntersectionObserver is unavailable', () => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver = undefined;
    const element = document.createElement('section');
    const { result } = renderHook(() => useViewportCoverage(element));
    expect(result.current).toBe(0);
  });
});
