import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { useActiveSection } from './useActiveSection';

type ObserverCallback = (entries: unknown[]) => void;

let capturedCallback: ObserverCallback | null = null;
let observed: string[] = [];
let disconnectSpy: Mock<() => void>;
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

  it('hands over to a section that entered at the band edge once the previous one leaves', () => {
    // Regression from a real navbar glide: Projects touched the band exactly at
    // its edge, so the observer reported it intersecting with zero height -- and
    // never again as it filled the band. Skills then left, and nothing won.
    addSections();
    const { getByTestId } = render(<Probe />);

    act(() => capturedCallback?.(band({ skills: 90 })));
    act(() => capturedCallback?.([{ target: { id: 'projects' }, isIntersecting: true, intersectionRect: { height: 0 } }]));
    expect(getByTestId('active').textContent).toBe('skills');

    act(() => capturedCallback?.(band({ skills: 0 })));
    expect(getByTestId('active').textContent).toBe('projects');
  });

  it('keeps Projects selected while its TV chapter holds a spent Contact position', async () => {
    addSections();
    const { getByTestId } = render(<Probe />);
    act(() => capturedCallback?.(band({ contact: 260 })));
    await act(async () => {
      document.getElementById('projects')!.dataset.projectsActive = 'true';
    });
    expect(getByTestId('active').textContent).toBe('projects');
    await act(async () => {
      document.getElementById('projects')!.removeAttribute('data-projects-active');
    });
    act(() => capturedCallback?.(band({ contact: 260 })));
    expect(getByTestId('active').textContent).toBe('contact');
  });

  it('keeps About selected through its pinned sequence and Education handoff', async () => {
    addSections();
    const { getByTestId } = render(<Probe />);
    const about = document.getElementById('about')!;
    act(() => capturedCallback?.(band({ contact: 260 })));
    await act(async () => { about.dataset.sequenceActive = 'true'; });
    expect(getByTestId('active').textContent).toBe('about');

    act(() => capturedCallback?.(band({ contact: 0, projects: 260 })));
    expect(getByTestId('active').textContent).toBe('about');
    await act(async () => {
      about.dataset.educationActive = 'true';
      delete about.dataset.sequenceActive;
    });
    expect(getByTestId('active').textContent).toBe('about');

    document.getElementById('skills')!.getBoundingClientRect = () => DOMRect.fromRect({
      x: 0, y: 80, width: 1440, height: 1000,
    });
    await act(async () => { delete about.dataset.educationActive; });
    expect(getByTestId('active').textContent).toBe('skills');
  });

  it('keeps Skills selected while its stage is still reading beyond its physical spacer', async () => {
    const sections = addSections();
    const skills = sections.find(section => section.id === 'skills')!;
    const { getByTestId } = render(<Probe />);
    act(() => capturedCallback?.(band({ projects: 260 })));
    await act(async () => { skills.dataset.skillsActive = 'true'; });
    expect(getByTestId('active').textContent).toBe('skills');
    document.getElementById('projects')!.getBoundingClientRect = () => DOMRect.fromRect({
      x: 0, y: 80, width: 1440, height: 1000,
    });
    await act(async () => { delete skills.dataset.skillsActive; });
    expect(getByTestId('active').textContent).toBe('projects');
  });

  it('prioritizes the visible Skills stage over an About sequence still releasing underneath it', async () => {
    addSections();
    const about = document.getElementById('about')!;
    const skills = document.getElementById('skills')!;
    about.dataset.sequenceActive = 'true';
    skills.dataset.skillsActive = 'true';
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('active').textContent).toBe('skills');
    act(() => capturedCallback?.(band({ projects: 260 })));
    expect(getByTestId('active').textContent).toBe('skills');
    await act(async () => { delete skills.dataset.skillsActive; });
    expect(getByTestId('active').textContent).toBe('about');
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

/**
 * IntersectionObserver as a browser runs it: sampled once per frame, reporting
 * only what changed since its last sample, with a fresh baseline per observe().
 */
class FrameObserver {
  static current: FrameObserver | null = null;
  private readonly seen = new Map<Element, boolean | null>();
  constructor(private readonly callback: ObserverCallback) {
    FrameObserver.current = this;
  }
  observe(el: Element) {
    this.seen.set(el, null);
  }
  unobserve(el: Element) {
    this.seen.delete(el);
  }
  disconnect() {
    this.seen.clear();
  }
  takeRecords() {
    return [];
  }
  frame(bands: Record<string, number>) {
    const entries: unknown[] = [];
    for (const [el, was] of this.seen) {
      const height = bands[(el as HTMLElement).id] ?? 0;
      if (was === height > 0) continue;
      this.seen.set(el, height > 0);
      entries.push({ target: el, isIntersecting: height > 0, intersectionRect: { height } });
    }
    if (entries.length) act(() => this.callback(entries));
  }
}

describe('useActiveSection across a fast navbar scroll', () => {
  beforeEach(() => {
    FrameObserver.current = null;
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver = FrameObserver;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver = originalObserver;
    document.body.innerHTML = '';
  });

  it('does not keep a section the observer never saw enter after the reader passes it', async () => {
    // Regression: Home -> Projects in the flat page. About released its pin
    // while Skills crossed the band between two observer samples; the measured
    // Skills height was never reported leaving and outranked Projects.
    const sections = addSections();
    const about = sections[1];
    const { getByTestId } = render(<Probe />);
    FrameObserver.current!.frame({ about: 76 });
    expect(getByTestId('active').textContent).toBe('about');

    const band = window.innerHeight * 0.5;
    for (const section of sections) {
      const over = section.id === 'skills';
      section.getBoundingClientRect = () => DOMRect.fromRect({
        x: 0, y: over ? band - 400 : band + 2000, width: 1440, height: 800,
      });
    }
    await act(async () => { about.dataset.sequenceActive = 'true'; });
    await act(async () => { delete about.dataset.sequenceActive; });
    expect(getByTestId('active').textContent).toBe('skills');

    FrameObserver.current!.frame({ projects: 76 });
    expect(getByTestId('active').textContent).toBe('projects');
  });
});
