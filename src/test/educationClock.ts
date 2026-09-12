import { act, cleanup, screen } from '@testing-library/react';
import { expect, vi } from 'vitest';
import gsap from 'gsap';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';

export const RAIL_HEIGHT = 3000;
export const FRAME_HEIGHT = 800;
let railTop = 400;
let publication = 0;

export function setupEducationClock() {
  vi.stubEnv('NODE_ENV', 'development');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  resetScrollProgress();
  resetScrollGesture();
  railTop = 400;
  publication = 0;
  window.innerHeight = FRAME_HEIGHT;
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.getAttribute('data-testid') !== 'education-rail') return original.call(this);
    return DOMRect.fromRect({ x: 0, y: railTop, width: 1440, height: RAIL_HEIGHT });
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === 'education-rail' ? RAIL_HEIGHT : FRAME_HEIGHT;
  });
}

export function cleanupEducationClock() {
  cleanup();
  gsap.ticker.sleep();
  resetScrollGesture();
  resetScrollProgress();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
}

export function advanceEducation(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
  gsap.ticker.sleep();
}

export function placeEducation(top: number) {
  railTop = top;
  act(() => setScrollProgress(++publication / 100));
  gsap.ticker.sleep();
}

export function wheelEducation(deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  gsap.ticker.sleep();
}

/** Seek the actual component-created GSAP timeline, including its callbacks. */
export function finishEducation(testId: string, time?: number) {
  const target = screen.getByTestId(testId);
  const tween = gsap.getTweensOf(target).find(animation => animation.parent !== gsap.globalTimeline);
  const timeline = tween?.parent;
  expect(timeline, `real GSAP timeline for ${testId}`).toBeDefined();
  if (!timeline) throw new Error(`No real GSAP timeline for ${testId}`);
  act(() => {
    if (time === undefined) timeline.progress(1);
    else timeline.time(time);
  });
  gsap.ticker.sleep();
}
