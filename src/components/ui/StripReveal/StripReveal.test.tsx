import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StripReveal } from './StripReveal';
import { DEFAULT_STRIP_COUNT } from '@/lib/motion/stripTransform';

const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion(),
}));

/** Runs the queued rAF callbacks, which is how the sweep is released. */
const flushFrame = () => act(() => vi.advanceTimersByTime(20));

const sheet = () => screen.queryByTestId('strip-sheet');
const stripStyles = () =>
  screen.getAllByTestId('strip').map((el) => (el as HTMLElement).style);

describe('StripReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders its children', () => {
    render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );
    expect(screen.getByText('Rail content')).toBeInTheDocument();
  });

  it('shows no sheet at rest', () => {
    render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );
    expect(sheet()).toBeNull();
  });

  it('sweeps when the reveal key changes', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );

    rerender(
      <StripReveal revealKey="ai">
        <p>Rail content</p>
      </StripReveal>
    );

    expect(sheet()).toBeInTheDocument();
    expect(screen.getAllByTestId('strip')).toHaveLength(DEFAULT_STRIP_COUNT);
  });

  it('covers first, then releases on the next frame', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>Rail content</p>
      </StripReveal>
    );

    // Covering: opaque and bent, with no transition to animate away from.
    expect(sheet()).toHaveAttribute('data-phase', 'covering');
    expect(stripStyles()[0].opacity).toBe('1');
    expect(stripStyles()[0].transition).toBe('none');

    flushFrame();

    expect(sheet()).toHaveAttribute('data-phase', 'clearing');
    expect(stripStyles()[0].opacity).toBe('0');
    expect(stripStyles()[0].transition).toContain('ms');
  });

  it('bends each strip further along the sheet while covering', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>c</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>c</p>
      </StripReveal>
    );

    const angles = stripStyles().map((style) =>
      Number(style.transform.replace(/[^0-9.-]/g, ''))
    );

    expect(angles[0]).toBeLessThan(angles[angles.length - 1]);
  });

  it('staggers the strips so the sweep reads as a bend, not a block wipe', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>c</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>c</p>
      </StripReveal>
    );
    flushFrame();

    const delays = stripStyles().map((style) => {
      const match = style.transition.match(/(\d+(?:\.\d+)?)ms(?=,|$)/);
      return match ? Number(match[1]) : 0;
    });

    expect(delays[delays.length - 1]).toBeGreaterThan(delays[0]);
  });

  it('tears the sheet down once the sweep finishes', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>c</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>c</p>
      </StripReveal>
    );
    flushFrame();

    act(() => vi.advanceTimersByTime(2000));

    expect(sheet()).toBeNull();
  });

  it('never unmounts its children during a sweep', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>Rail content</p>
      </StripReveal>
    );

    // A remount here would drop rail state, scroll position and loaded media.
    expect(screen.getByText('Rail content')).toBeInTheDocument();
  });

  it('hides the sheet from assistive technology', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>c</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>c</p>
      </StripReveal>
    );
    expect(sheet()).toHaveAttribute('aria-hidden', 'true');
  });

  it('honours a custom strip count', () => {
    const { rerender } = render(
      <StripReveal revealKey="all" strips={4}>
        <p>c</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai" strips={4}>
        <p>c</p>
      </StripReveal>
    );
    expect(screen.getAllByTestId('strip')).toHaveLength(4);
  });

  it('skips the sweep entirely under reduced motion', () => {
    reducedMotion.mockReturnValue(true);

    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>Rail content</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="ai">
        <p>Rail content</p>
      </StripReveal>
    );

    expect(sheet()).toBeNull();
    expect(screen.getByText('Rail content')).toBeInTheDocument();
  });

  it('does not sweep when the reveal key is unchanged', () => {
    const { rerender } = render(
      <StripReveal revealKey="all">
        <p>a</p>
      </StripReveal>
    );
    rerender(
      <StripReveal revealKey="all">
        <p>b</p>
      </StripReveal>
    );
    expect(sheet()).toBeNull();
  });
});
