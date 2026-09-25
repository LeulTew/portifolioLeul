import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHROME_GAP_PX, chromeClearance, chromeInsetTop, observeChromeInset } from './chromeInset';

let resize: (() => void) | null = null;
let disconnected = 0;

class FakeResizeObserver {
  constructor(callback: () => void) { resize = callback; }
  observe() {}
  disconnect() { disconnected++; }
}

/** A fixed header whose rendered height the test can change. */
function header(initial: number) {
  const element = document.createElement('header');
  document.body.append(element);
  let height = initial;
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => ({ height }) as DOMRect);
  return { element, resizeTo: (next: number) => { height = next; resize!(); } };
}
const padding = () => document.documentElement.style.scrollPaddingTop;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resize = null;
  disconnected = 0;
  document.body.innerHTML = '';
});

describe('the navbar inset keyboard reveals clear', () => {
  it('publishes the fixed header height as the inset, and the document scroll padding with room for a focus ring', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const bar = header(69.4);
    const release = observeChromeInset(bar.element);
    expect(chromeInsetTop()).toBe(70);
    expect(chromeClearance()).toBe(70 + CHROME_GAP_PX);
    expect(padding()).toBe(`${70 + CHROME_GAP_PX}px`);

    bar.resizeTo(132);
    expect(chromeInsetTop()).toBe(132);
    expect(padding()).toBe(`${132 + CHROME_GAP_PX}px`);

    release();
    expect(disconnected).toBe(1);
    expect(chromeInsetTop()).toBe(0);
    expect(chromeClearance()).toBe(0);
    expect(padding()).toBe('');
  });

  it('writes the document only when the height changes, not on every resize of the width', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const bar = header(82);
    const release = observeChromeInset(bar.element);
    document.documentElement.style.scrollPaddingTop = '1px';
    bar.resizeTo(82);
    bar.resizeTo(81.6);
    expect(padding()).toBe('1px');
    release();
  });

  it('measures once where the platform cannot observe resizes', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const release = observeChromeInset(header(98).element);
    expect(chromeInsetTop()).toBe(98);
    release();
    expect(chromeInsetTop()).toBe(0);
  });
});
