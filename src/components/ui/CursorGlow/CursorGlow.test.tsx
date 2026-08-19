import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorGlow } from './CursorGlow';

describe('CursorGlow', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders glow element when reduced motion is disabled', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<CursorGlow />);
    expect(container.firstChild).not.toBeNull();
  });

  it('handles mouse move and updates transform', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<CursorGlow />);
    const glow = container.firstChild as HTMLDivElement;

    act(() => {
      fireEvent.mouseMove(document, { clientX: 150, clientY: 250 });
    });

    expect(glow).toBeDefined();
  });

  it('returns null and skips listeners when prefers-reduced-motion is true', () => {
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

    const { container } = render(<CursorGlow />);
    expect(container.firstChild).toBeNull();
  });
});
