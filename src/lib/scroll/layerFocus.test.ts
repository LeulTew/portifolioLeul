import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { observeChromeInset } from './chromeInset';
import { installDocumentFocus, installLayerFocus, sequentialNeighbour, sequentialOrder, tabbableElements } from './layerFocus';
import { cancelSectionLanding } from './sectionLanding';

type Box = { top: number; bottom: number };
const boxes = new Map<Element, Box>();
const frames: FrameRequestCallback[] = [];
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function scrollable(element: HTMLElement, metrics: { scrollHeight?: number; clientHeight?: number } = {}) {
  let top = 0, left = 0;
  Object.defineProperty(element, 'scrollTop', { configurable: true, get: () => top, set: value => { top = value; } });
  Object.defineProperty(element, 'scrollLeft', { configurable: true, get: () => left, set: value => { left = value; } });
  for (const [name, value] of Object.entries(metrics)) {
    Object.defineProperty(element, name, { configurable: true, get: () => value });
  }
}
function place(id: string, top: number, height = 40) {
  boxes.set(byId(id), { top, bottom: top + height });
}
function tab(shift = false, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true, ...init });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}
function flushFrames() {
  while (frames.length) frames.shift()!(performance.now());
}

beforeEach(() => {
  document.body.innerHTML = `
    <nav><button id="logo">LT</button><button id="theme">Theme</button></nav>
    <div id="track">
      <div id="keys" data-focus-after="[data-surface]"><button id="previous">Previous</button><button id="next">Next</button></div>
      <div id="layer"><div id="group"><main id="main">
        <section id="home"><button id="cta">Explore</button></section>
        <section id="about"><p>Statements</p></section>
        <section id="contact"><a id="email" href="mailto:hello@example.com">Email</a>
          <textarea id="message"></textarea><button id="send">Send</button></section>
      </main></div></div>
    </div>
    <div id="stage"><div id="surface" data-surface>
      <button id="all">All</button>
      <div id="panel" tabindex="-1"><select id="picker"><option>1</option></select><a id="image" href="/a.jpg">Full image</a></div>
    </div><button id="back">Back to the scene</button></div>`;
  boxes.clear();
  frames.length = 0;
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.hasAttribute('data-no-box') ? [] : [{}]) as unknown as DOMRectList;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const box = boxes.get(this) ?? { top: 100, bottom: 140 };
    return { ...box, left: 0, right: 100, x: 0, y: box.top, width: 100, height: box.bottom - box.top, toJSON() {} } as DOMRect;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames.length = 0; });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('sequential focus stops', () => {
  it('skips what the browser would skip, and hidden or covered controls it would not', () => {
    byId('cta').setAttribute('tabindex', '-1');
    byId('send').setAttribute('disabled', '');
    byId('main').setAttribute('inert', '');
    byId('back').setAttribute('data-no-box', '');
    byId('logo').style.visibility = 'hidden';
    byId('theme').setAttribute('aria-hidden', 'true');
    expect(tabbableElements().map(stop => stop.id)).toEqual(['previous', 'next', 'all', 'picker', 'image']);
  });

  it('visits a focus-after group straight after the last stop of the surface it serves', () => {
    byId('main').setAttribute('inert', '');
    expect(sequentialOrder(tabbableElements()).map(stop => stop.id))
      .toEqual(['logo', 'theme', 'all', 'picker', 'image', 'previous', 'next', 'back']);
  });

  it('keeps document order while the served surface has no stops of its own', () => {
    byId('main').setAttribute('inert', '');
    byId('surface').setAttribute('inert', '');
    expect(sequentialOrder(tabbableElements()).map(stop => stop.id))
      .toEqual(['logo', 'theme', 'previous', 'next', 'back']);
  });

  it('moves from a focused non-stop by its place in the document, not by the moved group', () => {
    byId('main').setAttribute('inert', '');
    expect(sequentialNeighbour(byId('panel'), false)?.id).toBe('picker');
    expect(sequentialNeighbour(byId('panel'), true)?.id).toBe('all');
    expect(sequentialNeighbour(byId('image'), false)?.id).toBe('previous');
    expect(sequentialNeighbour(byId('next'), false)?.id).toBe('back');
    expect(sequentialNeighbour(byId('previous'), true)?.id).toBe('image');
    expect(sequentialNeighbour(byId('back'), false)).toBeNull();
    expect(sequentialNeighbour(byId('logo'), true)).toBeNull();
  });
});

describe('keyboard focus in the scroll layer', () => {
  let navigate: ReturnType<typeof vi.fn<(section: string) => void>>;
  let release: () => void;
  let rendered = 0;

  beforeEach(() => {
    navigate = vi.fn<(section: string) => void>();
    scrollable(byId('track'), { scrollHeight: 8000, clientHeight: 800 });
    scrollable(byId('layer'));
    scrollable(byId('message'));
    Object.defineProperty(byId('main'), 'scrollHeight', { configurable: true, get: () => 7000 });
    place('home', 0, 1100); place('cta', 600);
    place('about', 1100, 3700);
    place('contact', 4800, 1000); place('email', 5000); place('message', 5100, 120); place('send', 5260);
    rendered = 0;
    release = installLayerFocus({
      track: byId('track'), main: () => byId('main'), navigate, renderedScrollTop: () => rendered,
    });
  });
  afterEach(() => release());

  it('moves Tab focus without the browser reveal, and brings an offscreen chapter in by navigation', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    byId('cta').focus();
    const event = tab();
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('email'));
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('contact');
    expect(byId('layer').scrollTop).toBe(0);
  });

  it('lets the landing settle, then nudges a control the landing left below the fold', () => {
    byId('cta').focus();
    tab();
    place('contact', 80, 1000); place('email', 700);
    rendered = 4000;
    flushFrames();
    // 36px past the 704px reveal line, in track pixels: 36 * 7200 / 6200.
    expect(byId('track').scrollTop).toBeCloseTo(4000 + (36 * 7200) / 6200, 5);
  });

  it('nudges within the chapter already on screen instead of navigating again', () => {
    place('contact', 0, 1000); place('email', 200); place('message', 700, 120);
    byId('email').focus();
    tab();
    expect(document.activeElement).toBe(byId('message'));
    expect(navigate).not.toHaveBeenCalled();
    // 820 - (800 - 96) = 116px, in track pixels.
    expect(byId('track').scrollTop).toBeCloseTo((116 * 7200) / 6200, 5);
  });

  it('leaves a control that is already visible where it is', () => {
    place('contact', 0, 1000); place('email', 200); place('message', 300, 120);
    byId('email').focus();
    tab();
    expect(navigate).not.toHaveBeenCalled();
    expect(byId('track').scrollTop).toBe(0);
  });

  it('brings a control out from under the navbar', () => {
    // 4K: a 96px reveal margin sat inside the 102px navbar pill.
    const header = document.createElement('header');
    document.body.prepend(header);
    boxes.set(header, { top: 0, bottom: 132 });
    onTestFinished(observeChromeInset(header));
    place('contact', 0, 1000); place('email', 200); place('message', 110, 40);
    rendered = 1000;
    byId('email').focus();
    tab();
    expect(document.activeElement).toBe(byId('message'));
    expect(navigate).not.toHaveBeenCalled();
    // 110 - 132 = -22px, in track pixels.
    expect(byId('track').scrollTop).toBeCloseTo(1000 - (22 * 7200) / 6200, 5);
  });

  it('holds the html layer at zero when the browser reveals focus by scrolling it', () => {
    byId('email').focus();
    byId('layer').scrollTop = 13995;
    byId('layer').dispatchEvent(new Event('scroll'));
    expect(byId('layer').scrollTop).toBe(0);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('contact');
  });

  it('leaves scrollers inside the content alone', () => {
    byId('message').scrollTop = 40;
    byId('message').dispatchEvent(new Event('scroll'));
    expect(byId('message').scrollTop).toBe(40);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves the move to the browser when it cannot reproduce it', () => {
    document.body.focus();
    expect(tab().defaultPrevented).toBe(false);
    byId('cta').focus();
    expect(tab(false, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(tab(false, { altKey: true }).defaultPrevented).toBe(false);
    byId('back').focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('back'));
  });

  it('respects a component that already handled Tab', () => {
    byId('cta').focus();
    byId('cta').addEventListener('keydown', event => event.preventDefault());
    tab();
    expect(document.activeElement).toBe(byId('cta'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['a positive tabindex', () => byId('send').setAttribute('tabindex', '2')],
    ['a radio group', () => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'choice';
      byId('contact').append(radio);
    }],
  ])('leaves Tab native when the page uses %s, whose order it does not model', (_label, arrange) => {
    arrange();
    byId('cta').focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('cta'));
  });

  it('leaves Tab native inside a shadow root', () => {
    const host = document.createElement('div');
    byId('home').append(host);
    const inner = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
    inner.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, composed: true });
    inner.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves Tab native when it could enter a shadow tree the document query cannot see', () => {
    // Round 7 (TECH-005): button, host with a shadow button, button -- the shadow control was skipped.
    const host = document.createElement('div');
    byId('home').insertBefore(host, null);
    host.attachShadow({ mode: 'open' }).appendChild(document.createElement('button'));
    byId('cta').focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(byId('cta'));
  });

  it('stops listening once released', () => {
    release();
    byId('cta').focus();
    expect(tab().defaultPrevented).toBe(false);
    byId('layer').scrollTop = 500;
    byId('layer').dispatchEvent(new Event('scroll'));
    expect(byId('layer').scrollTop).toBe(500);
  });
});

describe('Tab through the story, chapter by chapter', () => {
  let navigate: ReturnType<typeof vi.fn<(section: string) => void>>;
  let release: () => void;

  beforeEach(() => {
    document.body.innerHTML = `
      <header><button id="logo">LT</button><button id="theme">Theme</button></header>
      <div id="track"><main id="main">
        <section id="home"><h1 id="title" tabindex="-1" data-section-landing="home" data-tab-entry="">Leul</h1>
          <button id="cta">Explore</button></section>
        <section id="about" tabindex="-1" data-section-landing="about"><p>Statements</p></section>
        <section id="skills"></section>
        <section id="projects"></section>
        <section id="contact"><div id="connect" tabindex="-1" data-section-landing="contact" data-tab-entry="">Connect</div>
          <a id="email" href="mailto:hello@example.com">Email</a></section>
      </main></div>
      <section id="skills-stage" aria-hidden="true" data-section-owner="skills">
        <h2 id="skills-heading" tabindex="-1" data-section-landing="skills" data-tab-entry="">Skills</h2>
        <button id="skill-next">Next skill</button></section>
      <div id="stage" inert data-section-owner="projects">
        <div id="reader" tabindex="-1" data-section-landing="projects" data-tab-entry=""><button id="details">Details</button></div>
        <button id="scene-next" data-section-landing="projects">Contact</button></div>`;
    navigate = vi.fn<(section: string) => void>();
    scrollable(byId('track'), { scrollHeight: 8000, clientHeight: 800 });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    view('home');
    release = installLayerFocus({ track: byId('track'), main: () => byId('main'), navigate });
  });
  afterEach(() => {
    release();
    cancelSectionLanding();
  });

  const SECTIONS = ['home', 'about', 'skills', 'projects', 'contact'];
  const HEIGHTS = [900, 2000, 1500, 1500, 900];
  /** Lays the story out with `section` under the reader, as drei's layer would. */
  function view(section: string) {
    let top = 0;
    const tops = SECTIONS.map((_, index) => { const at = top; top += HEIGHTS[index]; return at; });
    const offset = tops[SECTIONS.indexOf(section)];
    SECTIONS.forEach((id, index) => place(id, tops[index] - offset, HEIGHTS[index]));
    place('cta', 600 - offset); place('email', tops[4] + 200 - offset);
  }
  /** Which chapter holds the view: its reader live, everything else inert or hidden. */
  function live(section: 'home' | 'skills' | 'projects' | 'contact') {
    view(section);
    byId('main').toggleAttribute('inert', section === 'skills' || section === 'projects');
    if (section === 'skills') byId('skills-stage').removeAttribute('aria-hidden');
    else byId('skills-stage').setAttribute('aria-hidden', 'true');
    byId('stage').toggleAttribute('inert', section !== 'projects');
    flushFrames();
  }

  it('visits every chapter with controls in story order, forward', () => {
    // Round 7 (D-A11Y-001): Tab went from Home straight to Contact; round 8: past Skills entirely.
    byId('cta').focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith('skills');
    live('skills');
    expect(document.activeElement).toBe(byId('skills-heading'));
    tab();
    expect(document.activeElement).toBe(byId('skill-next'));
    // Past a portalled reader's last stop the document ends; the story does not.
    expect(tab().defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith('projects');
    live('projects');
    expect(document.activeElement).toBe(byId('reader'));
    tab();
    tab();
    expect(document.activeElement).toBe(byId('scene-next'));
    tab();
    expect(navigate).toHaveBeenLastCalledWith('contact');
    live('contact');
    expect(document.activeElement).toBe(byId('connect'));
    tab();
    expect(document.activeElement).toBe(byId('email'));
    expect(navigate).toHaveBeenCalledTimes(3);
    // And from Contact, the last chapter, Tab leaves for the browser.
    expect(tab().defaultPrevented).toBe(false);
  });

  it('mirrors the way back with Shift+Tab', () => {
    live('contact');
    byId('email').focus();
    tab(true);
    expect(navigate).toHaveBeenLastCalledWith('projects');
    live('projects');
    expect(document.activeElement).toBe(byId('reader'));
    tab(true);
    expect(navigate).toHaveBeenLastCalledWith('skills');
    live('skills');
    expect(document.activeElement).toBe(byId('skills-heading'));
    // Home's controls sit under the inert story while Skills holds the view: visited by navigating.
    tab(true);
    expect(navigate).toHaveBeenLastCalledWith('home');
    live('home');
    expect(document.activeElement).toBe(byId('title'));
    tab();
    expect(document.activeElement).toBe(byId('cta'));
  });

  it('starts from where the reader is, not from focus the wheel left behind', () => {
    byId('cta').focus();
    view('contact');
    tab();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(byId('email'));
  });

  it('moves within the chapter in view without navigating, from the navbar too', () => {
    live('skills');
    byId('theme').focus();
    tab();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(byId('skill-next'));
    view('contact');
    byId('main').removeAttribute('inert');
    byId('skills-stage').setAttribute('aria-hidden', 'true');
    byId('theme').focus();
    byId('cta').setAttribute('data-no-box', '');
    byId('title').setAttribute('data-no-box', '');
    tab();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(byId('email'));
  });

  it('leaves a reader that is in place to the ordinary order', () => {
    byId('projects').append(byId('reader'));
    byId('skills').append(byId('skills-stage'));
    byId('stage').removeAttribute('inert');
    byId('skills-stage').removeAttribute('aria-hidden');
    byId('cta').focus();
    tab();
    expect(navigate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(byId('skill-next'));
  });
});

describe('keyboard focus in the no-WebGL document', () => {
  let navigate: ReturnType<typeof vi.fn<(section: string) => void>>;
  let revealed: Element[];
  let release: () => void;

  /** What the browser does for Tab here: the key, then focus lands on the next stop. */
  const tabTo = (id: string, shift = false) => {
    tab(shift);
    byId(id).focus();
  };

  beforeEach(() => {
    navigate = vi.fn<(section: string) => void>();
    revealed = [];
    // The test DOM has no layout, so no reveal of its own.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: HTMLElement) { revealed.push(this); },
    });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    place('home', 0, 900); place('about', 900, 3900); place('contact', 4800, 1000);
    release = installDocumentFocus({ main: () => byId('main'), navigate });
  });
  afterEach(() => {
    release();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('settles the chapter Tab carries focus into, then keeps the control in view', () => {
    // Round 7 (D-FLAT-001): About's pinned overlay stayed painted over the stops after it.
    byId('cta').focus();
    tabTo('email');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('contact');
    expect(revealed).toEqual([]);
    flushFrames();
    expect(revealed).toEqual([byId('email')]);
  });

  it('settles the chapter Shift+Tab carries focus back into', () => {
    byId('email').focus();
    tabTo('cta', true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('home');
  });

  it('leaves focus moving within a chapter to the browser', () => {
    byId('email').focus();
    tabTo('message');
    flushFrames();
    expect(navigate).not.toHaveBeenCalled();
    expect(revealed).toEqual([]);
  });

  it('measures from the chapter in view when Tab starts outside the content', () => {
    place('home', -4800, 900); place('about', -3900, 3900); place('contact', 0, 1000);
    byId('logo').focus();
    tabTo('email');
    expect(navigate).not.toHaveBeenCalled();
    byId('logo').focus();
    tabTo('cta');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('home');
  });

  it('leaves pointer focus and focus it did not see a key for alone', () => {
    byId('cta').focus();
    tab();
    byId('email').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    byId('email').focus();
    byId('cta').focus();
    byId('email').focus();
    flushFrames();
    expect(navigate).not.toHaveBeenCalled();
    expect(revealed).toEqual([]);
  });

  it('ignores Tab that leaves the content', () => {
    byId('cta').focus();
    tabTo('logo', true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stops listening once released', () => {
    release();
    byId('cta').focus();
    tabTo('email');
    expect(navigate).not.toHaveBeenCalled();
  });
});
