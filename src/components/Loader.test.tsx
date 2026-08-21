import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Loader } from './Loader';

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

describe('Loader', () => {
  beforeEach(() => {
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

  it('triggers onLoaded callback when completed', () => {
    const onLoaded = vi.fn();
    render(<Loader minDurationMs={400} onLoaded={onLoaded} />);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});