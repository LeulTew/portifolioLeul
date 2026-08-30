/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FocusScrim } from './FocusScrim';
import { FULL_FOCUS_COVERAGE } from '@/lib/scroll/viewportCoverage';

type ObserverCallback = (entries: any[]) => void;

let capturedCallback: ObserverCallback | null = null;
let observedTargets: Element[] = [];
let disconnectSpy: ReturnType<typeof vi.fn>;
const originalObserver = globalThis.IntersectionObserver;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback;
  }
  observe(el: Element) {
    observedTargets.push(el);
  }
  unobserve() {}
  disconnect() {
    disconnectSpy();
  }
  takeRecords() {
    return [];
  }
}

const VIEWPORT = 800;

const entry = (visibleHeight: number, isIntersecting = visibleHeight > 0) => ({
  isIntersecting,
  intersectionRect: { height: visibleHeight },
  rootBounds: { height: VIEWPORT },
});

/** Renders the scrim inside a section, which is how sections use it. */
const renderInSection = (props = {}) =>
  render(
    <section id="skills">
      <FocusScrim {...props} />
    </section>
  );

const scrim = () => screen.getByTestId('focus-scrim');
const strengthOf = () => Number(scrim().getAttribute('data-focus-strength'));
const opacityOf = () => Number(scrim().style.opacity);

describe('FocusScrim', () => {
  beforeEach(() => {
    capturedCallback = null;
    observedTargets = [];
    disconnectSpy = vi.fn();
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    (globalThis as any).IntersectionObserver = originalObserver;
  });

  it('is fully transparent before its section is on screen', () => {
    renderInSection();
    expect(opacityOf()).toBe(0);
  });

  it('observes the section it was rendered into, not itself', () => {
    renderInSection();
    expect(observedTargets).toHaveLength(1);
    expect((observedTargets[0] as HTMLElement).id).toBe('skills');
  });

  it('is hidden from assistive technology', () => {
    renderInSection();
    expect(scrim()).toHaveAttribute('aria-hidden', 'true');
  });

  it('fades up as the section takes over the viewport', () => {
    renderInSection();

    act(() => {
      capturedCallback?.([entry(VIEWPORT * FULL_FOCUS_COVERAGE * 0.5)]);
    });

    expect(strengthOf()).toBeCloseTo(0.5, 3);
  });

  it('reaches peak opacity once the section dominates the viewport', () => {
    renderInSection({ maxOpacity: 0.9 });

    act(() => {
      capturedCallback?.([entry(VIEWPORT)]);
    });

    expect(strengthOf()).toBe(1);
    expect(opacityOf()).toBeCloseTo(0.9, 5);
  });

  it('fades back out to reveal the scene when the section leaves', () => {
    renderInSection();

    act(() => capturedCallback?.([entry(VIEWPORT)]));
    expect(strengthOf()).toBe(1);

    act(() => capturedCallback?.([entry(0, false)]));
    expect(strengthOf()).toBe(0);
  });

  it('treats a non-intersecting entry as fully off screen even if a rect is reported', () => {
    renderInSection();

    act(() => capturedCallback?.([entry(VIEWPORT, false)]));
    expect(strengthOf()).toBe(0);
  });

  it('uses the latest entry when the observer batches several', () => {
    renderInSection();

    act(() => {
      capturedCallback?.([entry(0, false), entry(VIEWPORT)]);
    });

    expect(strengthOf()).toBe(1);
  });

  it('ignores an empty callback batch', () => {
    renderInSection();
    act(() => capturedCallback?.([]));
    expect(strengthOf()).toBe(0);
  });

  it('falls back to the window height when rootBounds is null', () => {
    renderInSection();

    act(() => {
      capturedCallback?.([
        {
          isIntersecting: true,
          intersectionRect: { height: window.innerHeight },
          rootBounds: null,
        },
      ]);
    });

    expect(strengthOf()).toBe(1);
  });

  it('disconnects its observer on unmount', () => {
    const { unmount } = renderInSection();
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('renders inertly when IntersectionObserver is unavailable', () => {
    (globalThis as any).IntersectionObserver = undefined;
    expect(() => renderInSection()).not.toThrow();
    expect(opacityOf()).toBe(0);
  });
});
