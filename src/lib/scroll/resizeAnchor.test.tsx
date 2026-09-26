import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResizeAnchor } from './resizeAnchor';
import { publishSectionNavigation } from './sectionNavigation';

function Probe({ enabled = true }: { enabled?: boolean }) {
  useResizeAnchor(enabled);
  return null;
}

/** Document-space top and height of each section at the current viewport. */
const WIDE: Record<string, [number, number]> = {
  home: [0, 900], about: [900, 5580], skills: [6480, 4320], projects: [10800, 1551], contact: [12891, 900],
};
const SHORT: Record<string, [number, number]> = {
  home: [0, 560], about: [560, 3472], skills: [4032, 2688], projects: [6720, 1938], contact: [9258, 733],
};

let scrollY = 0;
let layout = WIDE;
let frames: FrameRequestCallback[] = [];

const flush = () => {
  const pending = frames;
  frames = [];
  pending.forEach(callback => callback(performance.now()));
};
const ratio = (id: string) => {
  const [top, height] = layout[id];
  return (scrollY + window.innerHeight / 2 - top) / height;
};
const resize = (width: number, height: number, next: typeof layout) => {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  layout = next;
  // The browser keeps the raw offset and may report a clamping scroll first.
  act(() => { window.dispatchEvent(new Event('scroll')); });
  act(() => flush());
  act(() => { window.dispatchEvent(new Event('resize')); });
};

describe('flat page resize anchoring', () => {
  let scrollBy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    frames = [];
    layout = WIDE;
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 900);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    scrollBy = vi.fn((options: ScrollToOptions) => { scrollY += options.top ?? 0; });
    vi.spyOn(window, 'scrollBy').mockImplementation(scrollBy as unknown as typeof window.scrollBy);
    document.body.innerHTML = '';
    for (const id of Object.keys(WIDE)) {
      const section = document.createElement('section');
      section.id = id;
      section.getBoundingClientRect = () => {
        const [top, height] = layout[id];
        return DOMRect.fromRect({ x: 0, y: top - scrollY, width: window.innerWidth, height });
      };
      document.body.appendChild(section);
    }
    scrollY = 10800 + 0.4 * 1551 - 450;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('keeps a Projects reader in Projects when the window gets shorter', () => {
    render(<Probe />);
    resize(900, 560, SHORT);
    expect(ratio('projects')).toBeCloseTo(0.4, 5);
    expect(scrollBy).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'instant' });
    act(() => flush());
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(ratio('projects')).toBeCloseTo(0.4, 5);
  });

  it('follows the reader between resizes and restores them on the way back', () => {
    render(<Probe />);
    resize(900, 560, SHORT);
    act(() => flush());
    scrollY = 9258 + 0.25 * 733 - 280;
    act(() => { window.dispatchEvent(new Event('scroll')); });
    act(() => flush());
    resize(1440, 900, WIDE);
    expect(ratio('contact')).toBeCloseTo(0.25, 5);
  });

  it('leaves the scroll alone when the page is not the flat document', () => {
    render(<Probe enabled={false} />);
    resize(900, 560, SHORT);
    act(() => flush());
    expect(scrollBy).not.toHaveBeenCalled();
  });

  describe('through a change of motion preference', () => {
    let motionListeners: (() => void)[];
    /** Skills re-staged as a tall track: every chapter below it moves down 3,300px. */
    const STAGED = Object.fromEntries(Object.entries(WIDE).map(([id, [top, height]]) =>
      [id, id === 'home' || id === 'about' ? [top, height] : id === 'skills' ? [top, height + 3300] : [top + 3300, height]],
    )) as typeof WIDE;

    beforeEach(() => {
      motionListeners = [];
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false, media: query,
        addEventListener: (_: string, listener: () => void) => { motionListeners.push(listener); },
        removeEventListener: vi.fn(),
      }));
    });

    it('keeps a Projects reader in Projects while the chapters rebuild', () => {
      // Round 11 (D-NAV-002): turning reduced motion off carried a Projects reader into Contact.
      render(<Probe />);
      // The stylesheet re-lays the page before the change event arrives.
      layout = STAGED;
      act(() => motionListeners.forEach(listener => listener()));
      // The browser's own anchoring moves the page, and reports it.
      scrollY += 3289 - 3300;
      act(() => { window.dispatchEvent(new Event('scroll')); });
      act(() => flush());
      expect(ratio('projects')).toBeCloseTo(0.4, 5);
      act(() => flush());
      expect(ratio('projects')).toBeCloseTo(0.4, 5);
    });

    it('lets the reader go the moment they scroll themselves', () => {
      render(<Probe />);
      act(() => motionListeners.forEach(listener => listener()));
      act(() => flush());
      act(() => { window.dispatchEvent(new Event('wheel')); });
      layout = STAGED;
      scrollBy.mockClear();
      act(() => flush());
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('gives the reader over to a navigation that places them itself', () => {
      // Round 14 (D-MOTION-001): Skills resumes its chapter by navigation, which the hold undid.
      render(<Probe />);
      act(() => motionListeners.forEach(listener => listener()));
      act(() => flush());
      act(() => publishSectionNavigation('skills', { source: 'navbar' }));
      layout = STAGED;
      scrollBy.mockClear();
      act(() => flush());
      expect(scrollBy).not.toHaveBeenCalled();
    });
  });
});
