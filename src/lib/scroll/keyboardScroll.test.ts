import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimScrollKeys, installKeyboardScroll, keyboardScrollDelta } from './keyboardScroll';

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
      <div data-projects-display=""><button id="reader-control">Next</button></div>
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
    [' ', {}, 700], [' ', { shiftKey: true }, -700], ['Home', {}, -1200], ['End', {}, 10_000 - 800 - 1200],
  ] as const)('moves the story from the body for %s %o by the browser distance', (name, modifiers, distance) => {
    // Round 7 (D-A11Y-001): 52 PageDown presses from a fresh load left the story on its first frame.
    const event = key(document.body, { key: name, ...modifiers });
    expect(event.defaultPrevented).toBe(false);
    expect(scrolled).toEqual([distance]);
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
    ['a field', 'field', 'ArrowDown'], ['a tab list', 'tab', 'ArrowDown'], ['the TV screen', 'reader-control', 'PageDown'],
    ['a button for Space', 'scene', ' '], ['another scroller', 'note', 'PageDown'],
  ])('leaves keys that %s uses itself', (_label, id, name) => {
    key(document.getElementById(id)!, { key: name });
    expect(scrolled).toEqual([]);
  });

  it('forwards only unmodified keys the page has not already used', () => {
    key(document.body, { key: 'PageDown', ctrlKey: true });
    key(document.body, { key: 'ArrowDown', altKey: true });
    key(document.body, { key: 'ArrowDown', shiftKey: true });
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
