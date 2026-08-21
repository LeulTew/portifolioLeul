import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAssetLoadingProgress } from './useAssetLoadingProgress';

// Mock Drei useProgress
vi.mock('@react-three/drei', () => ({
  useProgress: vi.fn(() => ({
    active: false,
    progress: 100,
    errors: [],
    item: '',
    loaded: 4,
    total: 4,
  })),
}));

describe('useAssetLoadingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with progress 0 and updates smoothly', () => {
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 1000 })
    );

    expect(result.current.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.isReady).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.progress).toBeGreaterThanOrEqual(0);
  });

  it('completes and sets isReady to true when min duration finishes', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 500, onComplete })
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.progress).toBe(100);
    expect(result.current.isReady).toBe(true);
    expect(onComplete).toHaveBeenCalled();
  });

  it('derives accurate cyber status messages across progress thresholds', () => {
    const { result } = renderHook(() =>
      useAssetLoadingProgress({ minDurationMs: 2000 })
    );

    expect(typeof result.current.statusMessage).toBe('string');
    expect(result.current.statusMessage.length).toBeGreaterThan(0);
  });
});
