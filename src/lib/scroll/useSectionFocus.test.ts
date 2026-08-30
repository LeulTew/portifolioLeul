import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSectionFocus } from './useSectionFocus';
import { ENTER_THRESHOLD } from '@/lib/motion/sectionChoreography';

type ObserverCallback = (entries: unknown[]) => void;

let capturedCallback: ObserverCallback | null = null;
const originalObserver = globalThis.IntersectionObserver;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const VIEWPORT = 1000;

/** Drives the observer to report a given share of the viewport covered. */
const cover = (share: number) =>
  act(() => {
    capturedCallback?.([
      {
        isIntersecting: share > 0,
        intersectionRect: { height: share * VIEWPORT },
        rootBounds: { height: VIEWPORT },
      },
    ]);
  });

describe('useSectionFocus', () => {
  let element: HTMLElement;

  beforeEach(() => {
    capturedCallback = null;
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
    element = document.createElement('section');
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      originalObserver;
  });

  it('has not entered before the section arrives', () => {
    const { result } = renderHook(() => useSectionFocus(element));
    expect(result.current.hasEntered).toBe(false);
    expect(result.current.coverage).toBe(0);
  });

  it('does not treat an arriving section as leaving', () => {
    // Coverage is low both on the way in and on the way out; only the second
    // is an exit.
    const { result } = renderHook(() => useSectionFocus(element));
    cover(0.2);
    expect(result.current.exit).toBe(0);
  });

  it('enters once coverage crosses the threshold', () => {
    const { result } = renderHook(() => useSectionFocus(element));
    cover(ENTER_THRESHOLD + 0.05);
    expect(result.current.hasEntered).toBe(true);
  });

  it('stays entered once it has arrived', () => {
    // Re-firing a composed reveal on every pass turns it into a flicker.
    const { result } = renderHook(() => useSectionFocus(element));
    cover(1);
    expect(result.current.hasEntered).toBe(true);

    cover(0);
    expect(result.current.hasEntered).toBe(true);
  });

  it('scrubs the exit from the first pixel of scroll', () => {
    // The exit used to sit at zero until the section was nearly half gone,
    // which read as the page not responding to the scroll at all.
    const { result } = renderHook(() => useSectionFocus(element));
    cover(1);
    expect(result.current.exit).toBe(0);

    cover(0.9);
    expect(result.current.exit).toBeCloseTo(0.1, 5);

    cover(0.5);
    expect(result.current.exit).toBeCloseTo(0.5, 5);

    cover(0);
    expect(result.current.exit).toBe(1);
  });

  it('reverses the exit when the reader scrolls back', () => {
    const { result } = renderHook(() => useSectionFocus(element));
    cover(1);
    cover(0.1);
    const leaving = result.current.exit;
    expect(leaving).toBeCloseTo(0.9, 5);

    cover(1);
    expect(result.current.exit).toBeLessThan(leaving);
    expect(result.current.exit).toBe(0);
  });

  it('honours a custom enter threshold', () => {
    const { result } = renderHook(() => useSectionFocus(element, 0.9));
    cover(0.5);
    expect(result.current.hasEntered).toBe(false);

    cover(0.95);
    expect(result.current.hasEntered).toBe(true);
  });

  it('stays inert without an element', () => {
    const { result } = renderHook(() => useSectionFocus(null));
    expect(result.current.hasEntered).toBe(false);
    expect(result.current.exit).toBe(0);
  });
});
