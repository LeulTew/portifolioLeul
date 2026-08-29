import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  getScrollProgress,
  setScrollProgress,
  subscribeScrollProgress,
  resetScrollProgress,
  useScrollProgress,
  useScrollRange,
} from './scrollProgress';

describe('scrollProgress store', () => {
  beforeEach(() => {
    resetScrollProgress();
  });

  it('starts at the top of the document', () => {
    expect(getScrollProgress()).toBe(0);
  });

  it('stores a published progress value', () => {
    setScrollProgress(0.42);
    expect(getScrollProgress()).toBe(0.42);
  });

  it('clamps values outside the normalized range', () => {
    setScrollProgress(4);
    expect(getScrollProgress()).toBe(1);
    setScrollProgress(-4);
    expect(getScrollProgress()).toBe(0);
  });

  it('treats non-finite input as the top of the document', () => {
    setScrollProgress(0.5);
    setScrollProgress(Number.NaN);
    expect(getScrollProgress()).toBe(0);
  });

  it('notifies subscribers when progress changes', () => {
    const listener = vi.fn();
    subscribeScrollProgress(listener);
    setScrollProgress(0.3);
    expect(listener).toHaveBeenCalledWith(0.3);
  });

  it('drops sub-epsilon jitter instead of notifying', () => {
    setScrollProgress(0.5);
    const listener = vi.fn();
    subscribeScrollProgress(listener);
    setScrollProgress(0.500001);
    expect(listener).not.toHaveBeenCalled();
    expect(getScrollProgress()).toBe(0.5);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeScrollProgress(listener);
    unsubscribe();
    setScrollProgress(0.7);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useScrollProgress', () => {
  beforeEach(() => {
    resetScrollProgress();
  });

  it('renders the current progress and follows later publishes', () => {
    const { result } = renderHook(() => useScrollProgress());
    expect(result.current).toBe(0);

    act(() => setScrollProgress(0.6));
    expect(result.current).toBe(0.6);
  });

  it('detaches its subscriber on unmount', () => {
    const { unmount } = renderHook(() => useScrollProgress());
    unmount();
    expect(() => setScrollProgress(0.9)).not.toThrow();
  });
});

describe('useScrollRange', () => {
  beforeEach(() => {
    resetScrollProgress();
  });

  it('is false before the range is entered', () => {
    const { result } = renderHook(() => useScrollRange(0.4, 0.6));
    expect(result.current).toBe(false);
  });

  it('flips to true inside the range and back out past the end', () => {
    const { result } = renderHook(() => useScrollRange(0.4, 0.6));

    act(() => setScrollProgress(0.5));
    expect(result.current).toBe(true);

    act(() => setScrollProgress(0.8));
    expect(result.current).toBe(false);
  });

  it('treats the range bounds as inclusive', () => {
    const { result } = renderHook(() => useScrollRange(0.4, 0.6));

    act(() => setScrollProgress(0.4));
    expect(result.current).toBe(true);

    act(() => setScrollProgress(0.6));
    expect(result.current).toBe(true);
  });

  it('does not re-render while progress moves within the range', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollRange(0.4, 0.6);
    });

    act(() => setScrollProgress(0.45));
    const rendersAfterEntering = renders;
    expect(result.current).toBe(true);

    act(() => setScrollProgress(0.5));
    act(() => setScrollProgress(0.55));

    expect(renders).toBe(rendersAfterEntering);
    expect(result.current).toBe(true);
  });
});
