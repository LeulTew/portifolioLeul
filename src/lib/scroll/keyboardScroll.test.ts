import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimScrollKeys, installKeyboardScroll, keyboardScrollDelta } from './keyboardScroll';
import { resetScrollGesture, subscribeScrollGesture } from './scrollGesture';

let track: HTMLElement;
let release: () => void;
const scrolled: number[] = [];

function key(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = `
    <header><nav><button id="about-link">About</button></nav></header>
    <div id="track"><main><section id="home"><button id="cta">Explore</button></section></main></div>
    <div id="stage">
      <h2 id="heading" tabindex="-1">Skills</h2>
      <button id="scene">Back</button>
      <a id="link" href="/work">Work</a>
      <input id="field" /><div role="tablist"><button id="tab" role="tab">All</button></div>
      <div id="notes" style="overflow-y: auto"><p id="note" tabindex="-1">Notes</p></div>
    </div>`;
  track = document.getElementById('track')!;
  Object.defineProperty(track, 'clientHeight', { configurable: true, value: 800 });
  Object.defineProperty(track, 'scrollHeight', { configurable: true, value: 10_000 });
  track.scrollTop = 1200;
  const notes = document.getElementById('notes')!;
  Object.defineProperty(notes, 'clientHeight', { configurable: true, value: 100 });
  Object.defineProperty(notes, 'scrollHeight', { configurable: true, value: 400 });
  scrolled.length = 0;
  track.scrollBy = vi.fn(({ top }: ScrollToOptions) => { scrolled.push(top!); }) as typeof track.scrollBy;
  release = installKeyboardScroll(track);
});
afterEach(() => {
  release();
  document.body.innerHTML = '';
});

describe('scroll keys outside the 3D track', () => {
  it.each([
    ['ArrowDown', {}, 40], ['ArrowUp', {}, -40], ['PageDown', {}, 700], ['PageUp', {}, -700],
    [' ', {}, 700], [' ', { shiftKey: true }, -700],
  ] as const)('moves the story from the body for %s %o by the browser distance', (name, modifiers, distance) => {
    // Round 7 (D-A11Y-001): 52 PageDown presses from a fresh load left the story on its first frame.
    const event = key(document.body, { key: name, ...modifiers });
    expect(event.defaultPrevented).toBe(false);
    expect(scrolled).toEqual([distance]);
  });

  it('leaves Home and End to story navigation rather than jumping the track past pinned chapters', () => {
    // Round 8 (D-FLAT-002): End put the track at its end with About still on screen.
    for (const init of [{ key: 'End' }, { key: 'Home' }, { key: 'End', ctrlKey: true }, { key: 'Home', ctrlKey: true }]) {
      expect(keyboardScrollDelta(new KeyboardEvent('keydown', init), track)).toBe(0);
      key(document.body, init);
    }
    expect(scrolled).toEqual([]);
  });

  it('moves the story from the navbar and from a heading focus has landed on', () => {
    key(document.getElementById('about-link')!, { key: 'PageDown' });
    key(document.getElementById('heading')!, { key: 'ArrowDown' });
    key(document.getElementById('link')!, { key: ' ' });
    expect(scrolled).toEqual([700, 40, 700]);
  });

  it('leaves keys inside the track to the browser', () => {
    expect(keyboardScrollDelta(new KeyboardEvent('keydown', { key: 'PageDown' }), track)).toBe(700);
    key(document.getElementById('cta')!, { key: 'PageDown' });
    expect(scrolled).toEqual([]);
  });

  it.each([
    ['a field', 'field', 'ArrowDown'], ['a tab list', 'tab', 'ArrowDown'],
    ['a button for Space', 'scene', ' '], ['another scroller', 'note', 'PageDown'],
  ])('leaves keys that %s uses itself', (_label, id, name) => {
    key(document.getElementById(id)!, { key: name });
    expect(scrolled).toEqual([]);
  });

  it('forwards only the modified keys the browser scrolls for', () => {
    key(document.body, { key: 'PageDown', ctrlKey: true });
    key(document.body, { key: 'ArrowDown', altKey: true });
    key(document.body, { key: 'ArrowDown', shiftKey: true });
    key(document.body, { key: 'PageDown', metaKey: true });
    key(document.body, { key: ' ', ctrlKey: true });
    const used = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
    used.preventDefault();
    document.body.dispatchEvent(used);
    key(document.body, { key: 'Tab' });
    expect(scrolled).toEqual([]);
  });

  it('yields to a chapter that claims the key, until it releases the claim', () => {
    const claim = vi.fn((event: KeyboardEvent) => event.key === 'PageUp');
    const unclaim = claimScrollKeys(claim);
    key(document.body, { key: 'PageUp' });
    key(document.body, { key: 'PageDown' });
    expect(scrolled).toEqual([700]);
    unclaim();
    key(document.body, { key: 'PageUp' });
    expect(scrolled).toEqual([700, -700]);
  });

  it('stops forwarding once released', () => {
    release();
    key(document.body, { key: 'PageDown' });
    expect(scrolled).toEqual([]);
  });
});

describe('one reading of a key for the scroll and the chapter request', () => {
  afterEach(() => resetScrollGesture());

  it.each([
    [' ', {}, 700, 'down'], [' ', { shiftKey: true }, -700, 'up'], ['PageUp', {}, -700, 'up'],
    ['ArrowDown', {}, 40, 'down'], ['PageDown', {}, 700, 'down'],
  ] as const)('scrolls and requests the same way for %s %o', (name, modifiers, distance, direction) => {
    // Round 8 (TECH-013): Shift+Space scrolled the track up while requesting the next chapter.
    const requests: string[] = [];
    const off = subscribeScrollGesture(request => requests.push(request));
    key(document.body, { key: name, ...modifiers });
    off();
    expect(scrolled).toEqual([distance]);
    expect(requests).toEqual([direction]);
  });

  it.each([
    ['Shift+ArrowDown', { key: 'ArrowDown', shiftKey: true }, 'body'],
    ['Control+PageDown', { key: 'PageDown', ctrlKey: true }, 'body'],
    ['Space on a button', { key: ' ' }, 'scene'],
    ['ArrowDown in a field', { key: 'ArrowDown' }, 'field'],
    ['ArrowDown on a tab', { key: 'ArrowDown' }, 'tab'],
    ['End, which navigates instead', { key: 'End' }, 'body'],
    ['Control+Home, which navigates instead', { key: 'Home', ctrlKey: true }, 'body'],
  ] as const)('neither scrolls nor requests for %s', (_label, init, id) => {
    const requests: string[] = [];
    const off = subscribeScrollGesture(request => requests.push(request));
    key(id === 'body' ? document.body : document.getElementById(id)!, init);
    off();
    expect(scrolled).toEqual([]);
    expect(requests).toEqual([]);
  });
});
