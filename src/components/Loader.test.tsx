import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Loader } from './Loader';

/*
 * The download, under the test's control.
 *
 * The loader no longer completes on a timer -- that was the defect -- so a
 * test that only advances the clock is asserting behaviour that is meant to be
 * gone. These drive the bytes instead.
 */
let publish: ((progress: unknown) => void) | null = null;

vi.mock('@/lib/assets/criticalAssets', () => ({
  loadCriticalAssets: (onProgress: (progress: unknown) => void) => {
    publish = onProgress;
    return new Promise(() => {});
  },
  releaseCriticalAssets: vi.fn(),
}));

const allBytesIn = () =>
  publish?.({
    loadedBytes: 1000,
    totalBytes: 1000,
    ratio: 1,
    settled: 4,
    total: 4,
    failed: 0,
  });

/**
 * Advances the clock in slices, letting React settle between them.
 *
 * The loader finishes through a chain of state hops -- fill reaches full, the
 * letters hold, the exit runs -- and each one is scheduled by the last, so a
 * single long advance only ever moves it one link.
 */
const settle = async (slices = 6, msPerSlice = 600) => {
  for (let i = 0; i < slices; i += 1) {
    await act(async () => {
      vi.advanceTimersByTime(msPerSlice);
      await Promise.resolve();
    });
  }
};

describe('Loader', () => {
  beforeEach(() => {
    publish = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders loader with liquid LEUL text and progressbar role', () => {
    render(<Loader minDurationMs={1000} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Leul')).toBeInTheDocument();
  });

  it('triggers onLoaded callback when completed', async () => {
    const onLoaded = vi.fn();
    render(<Loader minDurationMs={400} onLoaded={onLoaded} />);

    // Nothing has downloaded yet, so the page must stay shut however long it
    // is left. This is the reported bug, and it belongs in the loader's own
    // tests as well as the hook's.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onLoaded).not.toHaveBeenCalled();

    // Once the bytes are in, the fill completes and the exit follows.
    await act(async () => {
      allBytesIn();
      await Promise.resolve();
    });
    await settle();

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});