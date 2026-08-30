import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useActiveSection } from './useActiveSection';

type ObserverCallback = (entries: unknown[]) => void;

let capturedCallback: ObserverCallback | null = null;
let observed: string[] = [];
let disconnectSpy: ReturnType<typeof vi.fn>;
const originalObserver = globalThis.IntersectionObserver;
let observerOptions: IntersectionObserverInit | undefined;

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    capturedCallback = callback;
    observerOptions = options;
  }
  observe(el: Element) {
    observed.push((el as HTMLElement).id);
  }
  unobserve() {}
  disconnect() {
    disconnectSpy();
  }
  takeRecords() {
    return [];
  }
}

const IDS = ['home', 'about', 'skills', 'projects', 'contact'];

function Probe({ ids = IDS }: { ids?: string[] }) {
  return <span data-testid="active">{useActiveSection(ids)}</span>;
}

/** One entry per section, giving how much of the focus band each fills. */
const band = (heights: Record<string, number>) =>
  Object.entries(heights).map(([id, height]) => ({
    target: { id },
    isIntersecting: height > 0,
    intersectionRect: { height },
  }));

const addSections = (ids = IDS) =>
  ids.map((id) => {
    const el = document.createElement('section');
    el.id = id;
    document.body.appendChild(el);
    return el;
  });

describe('useActiveSection', () => {
  beforeEach(() => {
    capturedCallback = null;
    observed = [];
    observerOptions = undefined;
    disconnectSpy = vi.fn();
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      FakeIntersectionObserver;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver =
      originalObserver;
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('starts on the first section', () => {
    addSections();
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('active').textContent).toBe('home');
  });

  it('observes every section', () => {
    addSections();
    render(<Probe />);
    expect(observed).toEqual(IDS);
  });

  it('watches a band around the middle of the viewport', () => {
    addSections();
    render(<Probe />);
    expect(observerOptions?.rootMargin).toBe('-45% 0px -45% 0px');
    // A threshold list is what made tall sections unreachable.
    expect(observerOptions?.threshold).toBe(0);
  });

  it('activates the section filling most of the band', () => {
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ skills: 40, projects: 260 })));
    expect(getByTestId('active').textContent).toBe('projects');
  });

  it('activates a section far taller than the band', () => {
    // Regression: with a threshold on intersectionRatio, a section of 2748px
    // against a 216px band peaks at a ratio of 0.079 and can never reach the
    // 0.15 threshold, so About and Projects never activated at all.
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ about: 216 })));
    expect(getByTestId('active').textContent).toBe('about');
  });

  it('remembers sections the callback did not mention', () => {
    // A callback only reports what changed, so the winner may not be in it.
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ about: 260 })));
    act(() => capturedCallback?.(band({ skills: 30 })));

    expect(getByTestId('active').textContent).toBe('about');
  });

  it('hands over as the reader moves on', () => {
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ about: 260 })));
    act(() => capturedCallback?.(band({ about: 0, skills: 260 })));

    expect(getByTestId('active').textContent).toBe('skills');
  });

  it('keeps the last section when nothing is in the band', () => {
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ contact: 260 })));
    act(() => capturedCallback?.(band({ contact: 0 })));

    expect(getByTestId('active').textContent).toBe('contact');
  });

  it('waits for sections that have not mounted yet', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(<Probe />);
    expect(observed).toEqual([]);

    addSections();
    act(() => vi.advanceTimersByTime(300));

    expect(observed).toEqual(IDS);
    expect(getByTestId('active').textContent).toBe('home');
  });

  it('disconnects on unmount', () => {
    addSections();
    const { unmount } = render(<Probe />);
    unmount();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('stays inert with no sections named', () => {
    const { getByTestId } = render(<Probe ids={[]} />);
    expect(getByTestId('active').textContent).toBe('');
  });
});
