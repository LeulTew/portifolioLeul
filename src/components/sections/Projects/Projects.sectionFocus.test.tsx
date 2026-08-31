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

let capturedCallback: ObserverCallback | null = null;
let observedIds: string[] = [];
let disconnectSpy: Mock<() => void>;
const originalObserver = globalThis.IntersectionObserver;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback;
  }
  observe(el: Element) {
    observedIds.push(el.id);
  }
  unobserve() {}
  disconnect() {
    disconnectSpy();
  }
  takeRecords() {
    return [];
  }
}

const entry = (id: string, ratio: number) => ({
  target: { id },
  isIntersecting: ratio > 0,
  intersectionRatio: ratio,
});

describe('Projects section focus tracking', () => {
  beforeEach(() => {
    capturedCallback = null;
    observedIds = [];
    disconnectSpy = vi.fn();
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;

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

  it('keeps the rail focused while projects is the dominant section', () => {
    render(<Projects />);

    act(() => {
      capturedCallback?.([entry('projects', 0.6), entry('contact', 0.1)]);
    });

    expect(focusState()).toBe('true');
  });

  it('releases focus once contact becomes the dominant section', () => {
    render(<Projects />);

    act(() => {
      capturedCallback?.([entry('projects', 0.2), entry('contact', 0.7)]);
    });

    expect(focusState()).toBe('false');
  });

  it('restores focus when the user scrolls back up to projects', () => {
    render(<Projects />);

    act(() => {
      capturedCallback?.([entry('contact', 0.7)]);
    });
    expect(focusState()).toBe('false');

    act(() => {
      capturedCallback?.([entry('projects', 0.7)]);
    });
    expect(focusState()).toBe('true');
  });

  it('ignores callbacks where nothing is intersecting', () => {
    render(<Projects />);

    act(() => {
      capturedCallback?.([entry('projects', 0), entry('contact', 0)]);
    });

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
