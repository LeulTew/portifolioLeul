import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModernTVLoader } from './ModernTVLoader';

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

describe('ModernTVLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders standby state initially with accessibility attributes', () => {
    render(<ModernTVLoader minDurationMs={1000} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(screen.getByText('Leul')).toBeInTheDocument();
  });

  it('renders with light mode styling when theme is light', () => {
    const { container } = render(<ModernTVLoader theme="light" minDurationMs={1000} />);

    const overlay = container.querySelector('[class*="overlayLight"]');
    expect(overlay).toBeInTheDocument();
  });

  it('transitions through exit animation and triggers onLoaded when done', () => {
    const onLoaded = vi.fn();
    render(<ModernTVLoader minDurationMs={400} onLoaded={onLoaded} />);

    // Advance past minimum duration
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Advance past zoom exit animation
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});
