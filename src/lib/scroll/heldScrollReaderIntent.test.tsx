// Round 29 (TECH-081..084): the reader's later input retires held landings and reveals; disposal and a no-travel glide leave nothing behind.
// Adapted from the round-29 reviewer's counterexamples.
import { afterEach, expect, it, vi } from 'vitest';
import { glideScrollTo } from '@/lib/scroll/glideScroll';
import { installDocumentFocus, installLayerFocus, requestReveal } from '@/lib/scroll/layerFocus';
import { resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';

let stops: (() => void)[] = [];
afterEach(() => {
  stops.forEach(stop => stop()); stops = [];
  resetScrollGesture(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren();
});
const release = () => window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
function track() {
  const box = document.body.appendChild(document.createElement('div'));
  Object.defineProperties(box, {
    clientWidth: { value: 500 }, clientHeight: { value: 500 },
    clientLeft: { value: 0 }, scrollHeight: { value: 5000 },
  });
  box.getBoundingClientRect = () => DOMRect.fromRect({ width: 508, height: 500 });
  subscribeScrollGesture(() => {});
  return box;
}
const press = (box: HTMLElement) => box.dispatchEvent(new PointerEvent('pointerdown', {
  button: 0, buttons: 1, bubbles: true, clientX: 504, clientY: 10,
}));

it('REQ: cancelling an already-at-target glide retires its held redundant write', () => {
  const box = track(); box.scrollTop = 2000; press(box);
  const glide = glideScrollTo(box, 2000); glide.cancel();
  box.scrollTop = 1900; release();
  expect(box.scrollTop).toBe(1900);
});

it('REQ: spatial focus disposer retires its held reveal before a replacement controller mounts', () => {
  const box = track();
  box.innerHTML = '<main><section id="contact"><button id="feedback">Feedback</button></section></main>';
  const main = box.querySelector('main')!, section = main.firstElementChild!, field = box.querySelector('button')!;
  Object.defineProperty(main, 'scrollHeight', { value: 5000 });
  section.getBoundingClientRect = () => DOMRect.fromRect({ y: -box.scrollTop, height: 1500 });
  field.getBoundingClientRect = () => DOMRect.fromRect({ y: 650 - box.scrollTop, height: 36 });
  const stop = installLayerFocus({ track: box, main: () => main, navigate: () => {} });
  press(box); requestReveal(field); stop();
  box.scrollTop = 100; release();
  expect(box.scrollTop).toBe(100);
});

it('REQ: flat focus disposer retires its held in-place feedback reveal', () => {
  const box = track();
  document.body.insertAdjacentHTML('beforeend', '<main><section id="contact"><button id="feedback">Feedback</button></section></main>');
  const main = document.querySelector('main')!, section = main.firstElementChild!, field = main.querySelector('button')!;
  section.getBoundingClientRect = () => DOMRect.fromRect({ y: 0, height: 1500 });
  field.getBoundingClientRect = () => DOMRect.fromRect({ y: 650, height: 36 });
  const scrollIntoView = vi.fn(); field.scrollIntoView = scrollIntoView;
  const stop = installDocumentFocus({ main: () => main, navigate: () => {} });
  press(box); requestReveal(field); stop(); release();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('REQ: flat cross-chapter Tab reveal retires after its frame enters the held queue', () => {
  const box = track();
  document.body.insertAdjacentHTML('beforeend', '<main><section id="home"><button id="a">A</button></section><section id="about"><button id="b">B</button></section></main>');
  const main = document.querySelector('main')!, a = main.querySelector<HTMLButtonElement>('#a')!, b = main.querySelector<HTMLButtonElement>('#b')!;
  let frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const scrollIntoView = vi.fn(); b.scrollIntoView = scrollIntoView;
  stops.push(installDocumentFocus({ main: () => main, navigate: () => {} }));
  a.focus(); press(box);
  a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); b.focus({ preventScroll: true });
  for (let i = 0; i < 2; i++) { const due = frames; frames = []; due.forEach(cb => cb(i)); }
  publishSectionNavigation('contact'); a.focus({ preventScroll: true }); release();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('REQ: portalled own-box reveal retires on newer section navigation', () => {
  const box = track();
  box.innerHTML = '<main><section id="projects"></section></main>';
  document.body.insertAdjacentHTML('beforeend', '<div id="panel" style="overflow-y:auto" data-section-owner="projects"><button id="first">First</button><button id="second">Second</button></div>');
  const main = box.querySelector('main')!, panel = document.getElementById('panel')!, first = document.getElementById('first')!, second = document.getElementById('second')!;
  Object.defineProperties(panel, { scrollHeight: { value: 1000 }, clientHeight: { value: 100 } });
  panel.getBoundingClientRect = () => DOMRect.fromRect({ y: 0, height: 100 });
  for (const [el, y] of [[first, 0], [second, 250]] as const) {
    el.getBoundingClientRect = () => DOMRect.fromRect({ y: y - panel.scrollTop, height: 24, width: 100 });
    el.getClientRects = () => [el.getBoundingClientRect()] as unknown as DOMRectList;
  }
  stops.push(installLayerFocus({ track: box, main: () => main, navigate: () => {} }));
  first.focus(); press(box);
  first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(second);
  publishSectionNavigation('contact'); first.focus({ preventScroll: true }); release();
  expect(panel.scrollTop).toBe(0);
});
