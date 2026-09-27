/**
 * Scroll writes deferred under a held scrollbar thumb (round 27, TECH-075/076/077): a cancelled glide
 * leaves nothing to run, and a deferred write measures the page when it runs, not when it was asked.
 * Adapted from the round-27 reviewer's counterexamples.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { glideScrollTo } from '@/lib/scroll/glideScroll';
import { ownScroll, resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';

let clock = 0;
let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  resetScrollGesture(); clock = 0; frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => { resetScrollGesture(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function setup() {
  const el = document.body.appendChild(document.createElement('div'));
  Object.defineProperties(el, {
    clientWidth: { value: 500 }, clientLeft: { value: 0 },
    clientHeight: { value: 300 }, scrollHeight: { value: 5000 },
  });
  el.getBoundingClientRect = () => DOMRect.fromRect({ width: 508, height: 300 });
  el.scrollTop = 2000;
  subscribeScrollGesture(() => {});
  el.dispatchEvent(new PointerEvent('pointerdown', { button: 0, buttons: 1, bubbles: true, clientX: 504, clientY: 150 }));
  return el;
}
function advance(ms: number) {
  clock += ms; const due = frames; frames = []; due.forEach(callback => callback(clock));
}
const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));

it('REQ: cancel invalidates already-deferred glide frames, not only future RAF callbacks', () => {
  const el = setup();
  const glide = glideScrollTo(el, 4000, { now: () => clock, durationMs: 1000 });
  advance(300);
  expect(el.scrollTop).toBe(2000);
  glide.cancel(); release();
  expect(el.scrollTop).toBe(2000);
});

it('REQ: keyboard interruption retires a navigation queued under the thumb', () => {
  const el = setup();
  glideScrollTo(el, 4000, { now: () => clock, durationMs: 1000 });
  advance(300);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  el.scrollTop = 1900;
  el.dispatchEvent(new Event('scroll'));
  release();
  expect(el.scrollTop).toBe(1900);
});

it.each(['pointerup', 'pointercancel', 'blur', 'pointermove', 'pointerdown'])('CONTROL: lost-release fallback %s drains one deferred write', type => {
  const el = setup(); const write = vi.fn(() => { el.scrollTop = 2100; }); ownScroll(write);
  if (type === 'blur') window.dispatchEvent(new Event(type));
  else window.dispatchEvent(new PointerEvent(type, { button: 0, buttons: 0 }));
  expect(write).toHaveBeenCalledOnce(); expect(el.scrollTop).toBe(2100);
});

it('CONTROL: queue remains bounded and retains latest 32 writes in order', () => {
  setup(); const executed: number[] = [];
  for (let index = 0; index < 50; index++) ownScroll(() => { executed.push(index); });
  expect(executed).toEqual([]); release();
  expect(executed).toEqual(Array.from({ length: 32 }, (_, index) => index + 18));
});
