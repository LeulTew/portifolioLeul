import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { glideScrollTo } from './glideScroll';
import { installDocumentFocus, installLayerFocus } from './layerFocus';
import { useResizeAnchor } from './resizeAnchor';
import { resetScrollGesture, subscribeScrollGesture } from './scrollGesture';

/*
 * Round 30, TECH-085: thumb travel emptied the held queue, but a producer
 * still running -- a glide's next frame, a focus follow-up's second frame, a
 * resize settle -- queued its stale answer again, and it ran on release: a
 * reader who dragged 35px from Home was thrown to Contact.
 */

let clock = 0;
let frames = new Map<number, FrameRequestCallback>();
let seq = 0;
const stops: (() => void)[] = [];

beforeEach(() => {
  clock = 0;
  frames = new Map();
  seq = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++seq, fn); return seq; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  stops.splice(0).forEach(stop => stop());
  cleanup();
  resetScrollGesture();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const advance = (ms = 16) => act(() => {
  clock += ms;
  const due = [...frames.values()];
  frames.clear();
  due.forEach(fn => fn(clock));
});
const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
const travel = (box: HTMLElement, top: number) => {
  box.scrollTop = top;
  box.dispatchEvent(new Event('scroll'));
};

/** A scroller with its thumb pressed and held. */
function heldBox(): HTMLElement {
  const box = document.body.appendChild(document.createElement('div'));
  Object.defineProperties(box, {
    clientWidth: { value: 500 }, clientLeft: { value: 0 },
    clientHeight: { value: 500 }, scrollHeight: { value: 5000 },
  });
  box.getBoundingClientRect = () => DOMRect.fromRect({ width: 508, height: 500 });
  box.scrollTop = 2000;
  subscribeScrollGesture(() => {});
  box.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true, clientX: 504, clientY: 100 }));
  return box;
}

describe('a glide under a held thumb', () => {
  it('stops for good when the thumb travels: no later frame puts its destination back', () => {
    const box = heldBox();
    glideScrollTo(box, 4000, { now: () => clock, durationMs: 1000 });
    advance(200);
    travel(box, 1800);
    advance(900);
    advance(16);
    release();
    expect(box.scrollTop).toBe(1800);
    expect(frames.size).toBe(0);
  });

  it('lands on release when the reader held still', () => {
    const box = heldBox();
    glideScrollTo(box, 4000, { now: () => clock, durationMs: 1000 });
    advance(1100);
    release();
    expect(box.scrollTop).toBe(4000);
  });

  it('asked for after the travel still lands: only what came before it is superseded', () => {
    const box = heldBox();
    travel(box, 1800);
    glideScrollTo(box, 4000, { now: () => clock, durationMs: 1000 });
    advance(1100);
    release();
    expect(box.scrollTop).toBe(4000);
  });
});

describe('a flat focus follow-up under a held thumb', () => {
  const page = () => {
    const box = document.body.appendChild(document.createElement('div'));
    Object.defineProperties(box, {
      clientWidth: { value: 500 }, clientLeft: { value: 0 },
      clientHeight: { value: 500 }, scrollHeight: { value: 5000 },
    });
    box.getBoundingClientRect = () => DOMRect.fromRect({ width: 508, height: 500 });
    document.body.insertAdjacentHTML('beforeend',
      '<main><section id="home"><button id="a">A</button></section><section id="about"><button id="b">B</button></section></main>');
    const main = document.querySelector('main')!;
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    b.scrollIntoView = vi.fn();
    subscribeScrollGesture(() => {});
    stops.push(installDocumentFocus({ main: () => main, navigate: () => {} }));
    a.focus();
    box.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true, clientX: 504, clientY: 100 }));
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    b.focus({ preventScroll: true });
    return { box, b };
  };

  it('does not queue again once the thumb has travelled before its frames came', () => {
    const { box, b } = page();
    travel(box, 100);
    advance();
    advance();
    release();
    expect(b.scrollIntoView).not.toHaveBeenCalled();
  });

  it('reveals the stop on release when the reader held still', () => {
    const { b } = page();
    advance();
    advance();
    release();
    expect(b.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

function ResizeProbe() {
  useResizeAnchor(true);
  return null;
}

describe('a spatial cross-chapter reveal under a held thumb', () => {
  const page = () => {
    const box = document.body.appendChild(document.createElement('div'));
    Object.defineProperties(box, {
      clientWidth: { value: 500 }, clientLeft: { value: 0 },
      clientHeight: { value: 500 }, scrollHeight: { value: 5000 },
    });
    box.getBoundingClientRect = () => DOMRect.fromRect({ width: 508, height: 500 });
    box.innerHTML = '<main><section id="home"><button id="a">A</button></section><section id="about"><button id="b">B</button></section></main>';
    const main = box.querySelector('main')!;
    Object.defineProperty(main, 'scrollHeight', { value: 5000 });
    const place = (el: Element, y: number, height: number) => {
      el.getBoundingClientRect = () => DOMRect.fromRect({ y: y - box.scrollTop, height, width: 400 });
      el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
    };
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    place(main.children[0], 0, 1500);
    place(main.children[1], 1500, 1500);
    place(a, 100, 40);
    place(b, 2600, 40);
    const navigate = vi.fn();
    subscribeScrollGesture(() => {});
    stops.push(installLayerFocus({ track: box, main: () => main, navigate }));
    a.focus({ preventScroll: true });
    box.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true, clientX: 504, clientY: 100 }));
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return { box, b, navigate };
  };

  it('does not nudge over the thumb travel that came before its frames', () => {
    const { box, b, navigate } = page();
    expect(document.activeElement).toBe(b);
    expect(navigate).toHaveBeenCalledWith('about');
    travel(box, 100);
    advance();
    advance();
    release();
    expect(box.scrollTop).toBe(100);
  });

  it('nudges the stop into view on release when the reader held still', () => {
    const { box } = page();
    advance();
    advance();
    release();
    expect(box.scrollTop).toBeGreaterThan(0);
  });
});

describe('a resize settle under a held thumb', () => {
  const page = () => {
    const state = { y: 2000, sectionHeight: 5000 };
    const root = document.documentElement;
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 500);
    Object.defineProperty(document, 'scrollingElement', { configurable: true, get: () => root });
    vi.spyOn(root, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(root, 'clientHeight', 'get').mockReturnValue(500);
    vi.spyOn(root, 'scrollHeight', 'get').mockReturnValue(8000);
    vi.spyOn(root, 'scrollTop', 'get').mockImplementation(() => state.y);
    vi.spyOn(window, 'scrollBy').mockImplementation(((options: ScrollToOptions) => {
      state.y += options.top ?? 0;
    }) as typeof window.scrollBy);
    const section = document.body.appendChild(document.createElement('section'));
    section.id = 'home';
    section.getBoundingClientRect = () => DOMRect.fromRect({ y: -state.y, height: state.sectionHeight, width: 1000 });
    render(<ResizeProbe />);
    subscribeScrollGesture(() => {});
    root.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true, clientX: 1004, clientY: 225 }));
    state.sectionHeight = 4000;
    act(() => { window.dispatchEvent(new Event('resize')); });
    return state;
  };

  it('does not restore the old place over the thumb travel that came before its frame', () => {
    const state = page();
    state.y = 1800;
    document.dispatchEvent(new Event('scroll'));
    advance();
    release();
    expect(state.y).toBe(1800);
  });

  it('restores the reader\'s place on release when they held still', () => {
    const state = page();
    advance();
    release();
    // The centre sat 2250px into 5000; the same ratio of 4000 is 1800px, so the top comes to 1550.
    expect(state.y).toBe(1550);
  });
});
