// Round 28 (TECH-078): a glide whose timer ran out under a held thumb can still be retired before it lands.
// Adapted from the round-28 reviewer's counterexamples.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { glideScrollTo } from '@/lib/scroll/glideScroll';
import { forgetHeldScroll, ownScroll, resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { scrollContainerBy } from '@/lib/scroll/scrollContainer';

let clock = 0;
let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  resetScrollGesture(); clock = 0; frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
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
  clock += ms; const due = frames; frames = []; due.forEach(cb => cb(clock));
}
const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));

it('CONTROL: an unopposed terminal glide frame lands once on release', () => {
  const el = setup();
  glideScrollTo(el, 4000, { now: () => clock, durationMs: 1000 });
  advance(1100); expect(el.scrollTop).toBe(2000);
  release(); expect(el.scrollTop).toBe(4000);
});
it('REQ: cancelling after the animation clock ends still retires its unexecuted terminal write', () => {
  const el = setup();
  const glide = glideScrollTo(el, 4000, { now: () => clock, durationMs: 1000 });
  advance(1100); glide.cancel(); release();
  expect(el.scrollTop).toBe(2000);
});
it('REQ: newer reader input after the animation clock ends supersedes the held terminal write', () => {
  const el = setup();
  glideScrollTo(el, 4000, { now: () => clock, durationMs: 1000 });
  advance(1100);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
  el.scrollTop = 1900; el.dispatchEvent(new Event('scroll'));
  release(); expect(el.scrollTop).toBe(1900);
});
it('CONTROL: latest replacement moves to the tail, preserving chronology across keys', () => {
  setup(); const writes: string[] = []; const first = {}, second = {};
  ownScroll(() => writes.push('obsolete first'), { key: first });
  ownScroll(() => writes.push('second'), { key: second });
  ownScroll(() => writes.push('latest first'), { key: first });
  release(); expect(writes).toEqual(['second', 'latest first']);
});
it('CONTROL: cancelling one purpose does not drop a different purpose', () => {
  setup(); const writes: string[] = []; const first = {}, second = {};
  ownScroll(() => writes.push('first'), { key: first });
  ownScroll(() => writes.push('second'), { key: second });
  forgetHeldScroll(first); release(); expect(writes).toEqual(['second']);
});
it('CONTROL: repeated geometric corrections measure the reader current position and do not compound', () => {
  const el = setup(); const measurements: number[] = [];
  const destinationDelta = () => { measurements.push(el.scrollTop); return 2500 - el.scrollTop; };
  scrollContainerBy(el, destinationDelta);
  scrollContainerBy(el, destinationDelta);
  scrollContainerBy(el, destinationDelta);
  el.scrollTop = 1900; release();
  expect(el.scrollTop).toBe(2500); expect(measurements).toEqual([1900,2500,2500]);
});
