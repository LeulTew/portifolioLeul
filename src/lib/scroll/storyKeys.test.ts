import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { claimScrollKeys } from './keyboardScroll';
import { cancelSectionLanding } from './sectionLanding';
import type { SectionNavigationOptions } from './sectionNavigation';
import { installStoryKeys } from './storyKeys';

let navigate: Mock<(section: string, options: SectionNavigationOptions) => void>;
let release: () => void;

function press(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
const byId = (id: string) => document.getElementById(id)!;

function install(track: HTMLElement | null) {
  navigate = vi.fn<(section: string, options: SectionNavigationOptions) => void>();
  release = installStoryKeys({ navigate, track });
}

beforeEach(() => {
  document.body.innerHTML = `
    <header><button id="nav-about">About</button></header>
    <div id="track" style="overflow-y: auto">
      <main>
        <section id="home"><h1 id="title" tabindex="-1" data-section-landing="home">Leul</h1></section>
        <section id="about"><a id="story-link" href="#about">Story</a>
          <div id="notes" style="overflow-y: auto"><p id="note" tabindex="-1">Notes</p></div></section>
        <section id="contact"><div id="connect" tabindex="-1" data-section-landing="contact">Connect</div>
          <input id="name" /><div role="listbox" id="list" tabindex="0"></div></section>
      </main>
    </div>`;
  for (const [id, client, scroll] of [['track', 800, 10_000], ['notes', 100, 400]] as const) {
    Object.defineProperty(byId(id), 'clientHeight', { configurable: true, value: client });
    Object.defineProperty(byId(id), 'scrollHeight', { configurable: true, value: scroll });
  }
});
afterEach(() => {
  release();
  cancelSectionLanding();
  document.body.innerHTML = '';
});

describe('Home and End as the start and the end of the story', () => {
  it.each([['the 3D track', 'track'], ['the flat document', null]] as const)(
    'navigate as the navbar does in %s, without cancelling the key', (_label, trackId) => {
      // Round 8 (D-FLAT-002): End left About pinned on screen over the end of the page.
      install(trackId ? byId(trackId) : null);
      const end = press(document.body, { key: 'End' });
      const home = press(document.body, { key: 'Home' });
      expect(end.defaultPrevented).toBe(false);
      expect(home.defaultPrevented).toBe(false);
      expect(navigate.mock.calls).toEqual([
        ['contact', { source: 'navbar', edge: 'end' }],
        ['home', { source: 'navbar' }],
      ]);
      expect(document.activeElement).toBe(document.body);
    },
  );

  it('works from inside the track, and lands focus where the story arrives', () => {
    install(byId('track'));
    byId('story-link').focus();
    press(byId('story-link'), { key: 'End' });
    expect(navigate).toHaveBeenLastCalledWith('contact', { source: 'navbar', edge: 'end' });
    expect(byId('connect')).toHaveFocus();
    press(byId('connect'), { key: 'Home', ctrlKey: true });
    expect(navigate).toHaveBeenLastCalledWith('home', { source: 'navbar' });
    expect(byId('title')).toHaveFocus();
  });

  it('lands focus from the navbar too, as the navbar itself does', () => {
    install(byId('track'));
    byId('nav-about').focus();
    press(byId('nav-about'), { key: 'End' });
    expect(byId('connect')).toHaveFocus();
  });

  it.each([
    ['typing in a field', 'name', { key: 'End' }],
    ['a keyed widget', 'list', { key: 'Home' }],
    ['a box that scrolls on its own', 'note', { key: 'End' }],
    ['Shift, which selects rather than scrolls', 'story-link', { key: 'End', shiftKey: true }],
  ] as const)('leaves the key to %s', (_label, id, init) => {
    install(byId('track'));
    press(byId(id), init);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves a key a control handled, or a chapter claimed', () => {
    install(byId('track'));
    const handled = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    const unclaim = claimScrollKeys(event => event.key === 'Home');
    press(document.body, { key: 'Home' });
    unclaim();
    expect(navigate).not.toHaveBeenCalled();
    press(document.body, { key: 'Home' });
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('stops once released', () => {
    install(byId('track'));
    release();
    press(document.body, { key: 'End' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
