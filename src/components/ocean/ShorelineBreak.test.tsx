import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ShorelineBreak } from './ShorelineBreak';

// Mock @react-three/fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn((callback) => {
    callback({ clock: { getElapsedTime: () => 1.0 } }, 0.016);
  }),
}));

describe('ShorelineBreak Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dark theme shoreline break and unmounts cleanly', () => {
    const { unmount } = render(<ShorelineBreak theme="dark" />);
    expect(unmount).toBeDefined();
    unmount();
  });

  it('renders light theme shoreline break and unmounts cleanly', () => {
    const { unmount } = render(<ShorelineBreak theme="light" />);
    expect(unmount).toBeDefined();
    unmount();
  });
});
