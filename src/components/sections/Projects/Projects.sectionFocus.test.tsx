/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import React from 'react';
import { Projects } from './Projects';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const ReactModule = (await vi.importActual('react')) as any;
  return {
    ...actual,
    motion: {
      div: ReactModule.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>{children}</div>
      )),
    },
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => ({ get: () => 0 }),
  };
});

vi.mock('../../ui/expandable-tabs', () => ({
  ExpandableTabs: () => <div />,
}));

// Isolated so the only observer under test is the section-tracking one.
vi.mock('../../ui/FocusScrim', () => ({
  FocusScrim: () => <div data-testid="focus-scrim" />,
}));

vi.mock('@/lib/scroll/viewportCoverage', () => ({
  useViewportCoverage: () => 1,
  // The section is fully covered, as before -- the value simply reaches the
  // element directly now instead of through a re-render.
  useViewportShareEffect: (_element: unknown, onChange: (share: number) => void) => {
    onChange(1);
  },
  focusStrength: (share: number) => share,
}));

vi.mock('../../ui/StripReveal', () => ({
  StripReveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../ui/KineticText', () => ({
  KineticHeading: ({ text }: { text: string }) => <h2>{text}</h2>,
}));

// Surfaces the focus flag the section derives from scroll position.
vi.mock('../../ui/focus-rail', () => ({
  FocusRail: ({ isFocused }: { isFocused: boolean }) => (
    <div data-testid="focus-rail" data-focused={String(isFocused)} />
  ),
}));

type ObserverCallback = (entries: any[]) => void;
type Box = { top: number; height: number };

let observedIds: string[] = [];
let disconnectSpy: Mock<() => void>;
const originalObserver = globalThis.IntersectionObserver;

/** Resolves one rootMargin edge ("-45%" or "-20px") against the viewport. */
const marginPx = (value: string, viewport: number) =>
  value.endsWith('%') ? (parseFloat(value) / 100) * viewport : parseFloat(value) || 0;

/**
 * Chromium's IntersectionObserver rules, driven by explicit geometry: a target
 * is intersecting only once it reaches the first threshold, measured against
 * its OWN height, and an entry is queued only when that threshold index changes.
 */
class GeometryObserver {
  static current: GeometryObserver | null = null;
  private readonly indices = new Map<Element, number>();

  constructor(
    private readonly callback: ObserverCallback,
    private readonly options: IntersectionObserverInit = {}
  ) {
    GeometryObserver.current = this;
  }

  observe(el: Element) {
    observedIds.push(el.id);
    this.indices.set(el, -1);
  }
  unobserve(el: Element) {
    this.indices.delete(el);
  }
  disconnect() {
    disconnectSpy();
    this.indices.clear();
  }
  takeRecords() {
    return [];
  }

  layout(viewport: number, boxes: Record<string, Box>) {
    const [top = '0px', , bottom = top] = (this.options.rootMargin || '0px').trim().split(/\s+/);
    const bandTop = -marginPx(top, viewport);
    const bandBottom = viewport + marginPx(bottom, viewport);
    const thresholds = ([] as number[]).concat(this.options.threshold ?? 0);
    const entries: any[] = [];
    this.indices.forEach((previous, target) => {
      const box = boxes[target.id];
      if (!box) return;
      const overlap = Math.min(box.top + box.height, bandBottom) - Math.max(box.top, bandTop);
      const ratio = overlap >= 0 ? overlap / box.height : 0;
      const above = thresholds.findIndex(threshold => threshold > ratio);
      const index = overlap < 0 ? 0 : above === -1 ? thresholds.length : above;
      if (index === previous) return;
      this.indices.set(target, index);
      const isIntersecting = index > 0;
      entries.push({
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? ratio : 0,
        intersectionRect: { height: isIntersecting ? overlap : 0 },
        rootBounds: { top: bandTop, height: bandBottom - bandTop },
      });
    });
    if (entries.length) this.callback(entries);
  }
}

/** Flat page geometry at a scroll offset: Projects, the 60vh spacer, then Contact. */
const page = (scroll: number, viewport = 900, projectsHeight = 1500) => ({
  projects: { top: -scroll, height: projectsHeight },
  contact: { top: projectsHeight + viewport * 0.6 - scroll, height: 733 },
});

const layout = (viewport: number, boxes: Record<string, Box>) =>
  act(() => GeometryObserver.current?.layout(viewport, boxes));

describe('Projects section focus tracking', () => {
  beforeEach(() => {
    GeometryObserver.current = null;
    observedIds = [];
    disconnectSpy = vi.fn();
    (globalThis as any).IntersectionObserver = GeometryObserver;

    document.body.innerHTML =
      '<div id="projects"></div><div id="contact"></div>';
  });

  afterEach(() => {
    (globalThis as any).IntersectionObserver = originalObserver;
    document.body.innerHTML = '';
  });

  const focusState = () =>
    screen.getByTestId('focus-rail').getAttribute('data-focused');

  it('observes both the projects and contact anchors', () => {
    render(<Projects />);
    expect(observedIds).toEqual(expect.arrayContaining(['projects', 'contact']));
  });

  it('keeps the rail focused while projects fills the focus band', () => {
    render(<Projects />);
    layout(900, page(600));

    expect(focusState()).toBe('true');
  });

  it('releases focus once contact fills the focus band', () => {
    render(<Projects />);
    layout(900, page(600));
    layout(900, page(1940));

    expect(focusState()).toBe('false');
  });

  it('restores focus when the user scrolls back up to projects', () => {
    render(<Projects />);
    layout(900, page(1940));
    expect(focusState()).toBe('false');

    layout(900, page(600));
    expect(focusState()).toBe('true');
  });

  it('holds its state while the band crosses the spacer between sections', () => {
    render(<Projects />);
    layout(900, page(600));
    layout(900, page(1300));
    expect(focusState()).toBe('true');

    layout(900, page(1940));
    layout(900, page(1300));
    expect(focusState()).toBe('false');
  });

  it('restores the reading copy after a compact resize and return', () => {
    // Regression: at 900x560, Projects is 1938px tall. A 30% band gives it a
    // ratio of at most 0.087, so a 0.15 threshold could never report it again
    // after Contact had claimed the band.
    render(<Projects />);
    layout(900, page(600));
    layout(560, page(2100, 560, 1938));
    expect(focusState()).toBe('false');

    layout(560, page(1200, 560, 1938));
    expect(focusState()).toBe('true');
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<Projects />);
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('does not blow up when the anchors are absent', () => {
    document.body.innerHTML = '';
    expect(() => render(<Projects />)).not.toThrow();
  });
});