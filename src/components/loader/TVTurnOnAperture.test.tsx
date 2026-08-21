import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TVTurnOnAperture } from './TVTurnOnAperture';

describe('TVTurnOnAperture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders top-left and bottom-right diagonal split shutters in dark mode', () => {
    const onComplete = vi.fn();
    const { container } = render(<TVTurnOnAperture onComplete={onComplete} theme="dark" />);

    const topLeftShutter = container.querySelector('[class*="topLeftDiagonalShutter"]');
    const bottomRightShutter = container.querySelector('[class*="bottomRightDiagonalShutter"]');

    expect(topLeftShutter).toBeInTheDocument();
    expect(bottomRightShutter).toBeInTheDocument();
  });

  it('renders diagonal shutters with light theme styling in light mode', () => {
    const onComplete = vi.fn();
    const { container } = render(<TVTurnOnAperture onComplete={onComplete} theme="light" />);

    const topLeftShutterLight = container.querySelector('[class*="topLeftDiagonalShutterLight"]');
    const bottomRightShutterLight = container.querySelector('[class*="bottomRightDiagonalShutterLight"]');

    expect(topLeftShutterLight).toBeInTheDocument();
    expect(bottomRightShutterLight).toBeInTheDocument();
  });

  it('calls onComplete when the diagonal shutter expansion finishes', () => {
    const onComplete = vi.fn();
    render(<TVTurnOnAperture onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(950);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
