import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initScrollGesture,
  ownScroll,
  resetScrollGesture,
  subscribeScrollbarPress,
  subscribeScrollGesture,
  type ScrollDirection,
} from './scrollGesture';
import { CENSUS_EXCLUDED, CENSUS_SOURCE, findUnownedScrollWriters } from '@/test/scrollWriterCensus';

/**
 * A gesture is an intention, never a permission.
 *
 * The module this replaced cancelled wheel events whenever it believed an
 * animation was running, and a beat that flip-flopped its own trigger every
 * frame therefore cancelled input on roughly every other frame -- the reader
 * was pinned in About with the page refusing to move. The whole value of this
 * one is that it cannot do that, so that is what is asserted hardest.
 */
describe('scrollGesture', () => {
  beforeEach(() => resetScrollGesture());
  afterEach(() => {
    resetScrollGesture();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  const seen: ScrollDirection[] = [];
  const listen = () => {
    seen.length = 0;
    return subscribeScrollGesture((d) => seen.push(d));
  };

  it('reports the direction of a wheel notch', () => {
    const off = listen();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120 }));
    expect(seen).toEqual(['down', 'up']);
    off();
  });

  describe('a drag of a scrollbar', () => {
    // Round 22-23 (D-MOTION-006/007): the thumb moved the page past every chapter that waits for a gesture.
    const scroller = () => {
      const element = document.body.appendChild(document.createElement('div'));
      Object.defineProperties(element, {
        clientWidth: { value: 1432 }, clientHeight: { value: 900 }, scrollHeight: { value: 15795 }, clientLeft: { value: 0 },
      });
      element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 1440, height: 900 });
      element.scrollTop = 5000;
      return element;
    };
    const press = (target: Element, clientX: number) =>
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY: 400 }));
    const travel = (element: HTMLElement, to: number) => {
      element.scrollTop = to;
      element.dispatchEvent(new Event('scroll'));
    };

    it('is one wave from press to release, in the direction the page travels', () => {
      const page = scroller();
      const starts: ScrollDirection[] = [];
      const offStarts = subscribeScrollGesture(direction => starts.push(direction), { startsOnly: true });
      const off = listen();
      press(page, 1436);
      travel(page, 4800);
      travel(page, 4600);
      travel(page, 4602);
      travel(page, 4900);
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      travel(page, 6000);
      expect(seen).toEqual(['up', 'up', 'down']);
      expect(starts).toEqual(['up']);
      off();
      offStarts();
    });

    it('is not a press on the content, a scroll with nothing pressed, or another scroller', () => {
      const page = scroller();
      const other = scroller();
      const content = page.appendChild(document.createElement('div'));
      const off = listen();
      travel(page, 4000);
      press(content, 1436);
      travel(page, 3000);
      press(page, 600);
      travel(page, 2000);
      press(page, 1436);
      travel(other, 100);
      expect(seen).toEqual([]);
      off();
    });

    it('ends at a move with no button held, when the release was never heard', () => {
      const page = scroller();
      const off = listen();
      press(page, 1436);
      travel(page, 4000);
      window.dispatchEvent(new PointerEvent('pointermove', { buttons: 0 }));
      travel(page, 3000);
      expect(seen).toEqual(['up']);
      off();
    });

    it("does not report a scroll the page makes for itself while the thumb is held", () => {
      // Round 24 (TECH-068): held still under an engaged TV, a forwarded scroll read as a request to retreat.
      const page = scroller();
      const off = listen();
      press(page, 1436);
      ownScroll(() => { page.scrollTop = 4840; });
      page.dispatchEvent(new Event('scroll'));
      expect(seen).toEqual([]);
      // What the reader moves the thumb by is still theirs, measured from the thumb.
      travel(page, 4700);
      expect(seen).toEqual(['up']);
      off();
    });

    it('writes nothing under a held thumb, and makes the held writes, in order, on release', () => {
      // Round 25-26 (TECH-069/072/073): the browser put the page back under the thumb at places neither
      // chose, and telling those from the reader's travel by position reversed, lost and invented requests.
      const page = scroller();
      const off = listen();
      press(page, 1436);
      ownScroll(() => { page.scrollTop = 4840; });
      ownScroll(() => { page.scrollTop += 10; });
      expect(page.scrollTop).toBe(5000);
      travel(page, 4900);
      expect(seen).toEqual(['up']);
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      expect(page.scrollTop).toBe(4850);
      page.dispatchEvent(new Event('scroll'));
      expect(seen).toEqual(['up']);
      off();
    });

    it('keeps the direction of a small genuine drag whatever the page asked for meanwhile', () => {
      // Round 26 (TECH-072): after an own write to 4840, a 6px thumb move up read as down.
      const page = scroller();
      const off = listen();
      press(page, 1436);
      ownScroll(() => { page.scrollTop = 4840; });
      travel(page, 4994);
      ownScroll(() => { page.scrollTop = 5160; });
      travel(page, 4900);
      travel(page, 5000);
      expect(seen).toEqual(['up', 'up', 'down']);
      off();
    });

    it('holds a chapter settling the page from inside the drag it answered until the thumb is let go', () => {
      const page = scroller();
      const seenHere: ScrollDirection[] = [];
      const off = subscribeScrollGesture(direction => {
        seenHere.push(direction);
        if (seenHere.length === 1) ownScroll(() => { page.scrollTop = 5350; });
      });
      press(page, 1436);
      travel(page, 5200);
      travel(page, 5260);
      expect(seenHere).toEqual(['down', 'down']);
      window.dispatchEvent(new PointerEvent('pointercancel'));
      expect(page.scrollTop).toBe(5350);
      off();
    });

    it("tells the page's own movers the reader took the page, and makes held writes if nobody is left listening", () => {
      const page = scroller();
      const pressed = vi.fn();
      const offPress = subscribeScrollbarPress(pressed);
      const off = listen();
      page.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 600, clientY: 400 }));
      expect(pressed).not.toHaveBeenCalled();
      press(page, 1436);
      expect(pressed).toHaveBeenCalledOnce();
      ownScroll(() => { page.scrollTop = 4000; });
      off();
      offPress();
      expect(page.scrollTop).toBe(4000);
    });
  });

  it('routes every programmatic scroll write in the app through ownScroll', () => {
    // Round 25-26 (TECH-071/074): a portalled reveal bypassed it, and a text scan missed writers.
    const root = join(process.cwd(), 'src');
    const bypasses: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (path !== join(root, 'test')) walk(path);
          continue;
        }
        if (!CENSUS_SOURCE.test(entry.name) || CENSUS_EXCLUDED.test(entry.name)) continue;
        for (const writer of findUnownedScrollWriters(readFileSync(path, 'utf8'), entry.name)) {
          bypasses.push(`${path.slice(root.length + 1)}:${writer.line}: ${writer.text}`);
        }
      }
    };
    walk(root);
    expect(bypasses).toEqual([]);
  });

  describe('the scroll writer census itself', () => {
    const flagged = (source: string, fileName = 'fixture.ts') =>
      findUnownedScrollWriters(source, fileName).map(writer => writer.text);

    it('finds every form of write outside ownScroll', () => {
      expect(flagged('el.scrollTop = 1;')).toEqual(['el.scrollTop = 1']);
      expect(flagged('el.scrollTop /= 2;')).toEqual(['el.scrollTop /= 2']);
      expect(flagged('el.scrollLeft ??= 3;')).toEqual(['el.scrollLeft ??= 3']);
      expect(flagged('el.scrollTop++; --el.scrollLeft;')).toEqual(['el.scrollTop++', '--el.scrollLeft']);
      expect(flagged("el['scrollTop'] = 1;")).toEqual(["el['scrollTop'] = 1"]);
      expect(flagged('el.scrollTo ({ top: 1 });')).toEqual(['el.scrollTo ({ top: 1 })']);
      expect(flagged('el.scroll({ top: 1 }); scrollBy(0, 1);')).toEqual(['el.scroll({ top: 1 })', 'scrollBy(0, 1)']);
      expect(flagged('node.scrollIntoView();', 'fixture.js')).toEqual(['node.scrollIntoView()']);
      expect(flagged('ownScroll(() => {}); el.scrollTop = 2;')).toEqual(['el.scrollTop = 2']);
      expect(flagged('// ownScroll(() => {\nel.scrollTop = 1;')).toEqual(['el.scrollTop = 1']);
      expect(flagged('other(() => { el.scrollTop = 1; });')).toEqual(['el.scrollTop = 1']);
    });

    it('passes writes inside ownScroll however they are laid out, and never flags a read or a string', () => {
      expect(flagged('ownScroll (() => { el.scrollTop = 1; });')).toEqual([]);
      expect(flagged('ownScroll(function () { window.scrollBy(0, 1); });')).toEqual([]);
      expect(flagged(`ownScroll(() => {\n  a();\n  b();\n  c();\n  d();\n  e();\n  el.scrollTop += 1;\n});`)).toEqual([]);
      expect(flagged('ownScroll(() => el?.scrollIntoView({ block: "start" }));')).toEqual([]);
      expect(flagged('const y = el.scrollTop; if (el.scrollTop === 0) f(el.scrollLeft);')).toEqual([]);
      expect(flagged('const doc = "el.scrollTop = 1"; const t = `scrollTo(0)`;')).toEqual([]);
    });
  });

  it('never cancels a wheel event', () => {
    const off = listen();
    const event = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    window.dispatchEvent(event);

    expect(seen).toEqual(['down']);
    expect(event.defaultPrevented).toBe(false);
    off();
  });

  it('lets a reader exclude its own native scroll region without suppressing other subscribers', () => {
    const details = document.createElement('div');
    details.dataset.projectsScrollable = '';
    document.body.append(details);
    const scene = vi.fn();
    const all = vi.fn();
    const offScene = subscribeScrollGesture(scene, {
      ignoreTarget: target => target instanceof Element && !!target.closest('[data-projects-scrollable]'),
    });
    const offAll = subscribeScrollGesture(all);
    for (const event of [
      new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }),
    ]) {
      details.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(scene).not.toHaveBeenCalled();
    expect(all).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    expect(scene).toHaveBeenCalledExactlyOnceWith('down');
    offScene();
    offAll();
  });

  it('registers every listener as passive, so cancelling is impossible', () => {
    /*
     * Asserted at the registration rather than at the event, because passive is
     * the guarantee: a later edit that adds `preventDefault()` to a handler
     * would be ignored by the browser with a console warning, instead of
     * silently trapping the reader.
     */
    resetScrollGesture();
    const add = vi.spyOn(window, 'addEventListener');
    initScrollGesture();

    const scrollish = add.mock.calls.filter(([type]) =>
      ['wheel', 'touchstart', 'touchmove', 'touchend', 'keydown'].includes(
        type as string
      )
    );
    expect(scrollish.length).toBe(5);
    for (const [, , options] of scrollish) {
      expect(options).toMatchObject({ passive: true });
    }
    // The scrollbar's press, travel and release are heard the same way: never cancellable.
    const drag = add.mock.calls.filter(([type]) =>
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'scroll', 'blur'].includes(type as string));
    expect(drag.length).toBe(6);
    for (const [, , options] of drag) expect(options).toMatchObject({ passive: true });
    add.mockRestore();
  });

  it('ignores trackpad settling below the threshold', () => {
    const off = listen();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
    expect(seen).toEqual([]);
    off();
  });

  it('reports the keys that scroll, and nothing else', () => {
    const off = listen();
    for (const key of ['ArrowDown', 'PageUp', 'a', 'Shift', 'ArrowUp']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }
    expect(seen).toEqual(['down', 'up', 'up']);
    off();
  });

  it('asks no beat for more on Home or End, which navigate to the ends of the story', () => {
    // Round 8 (D-FLAT-002): see storyKeys.
    const off = listen();
    for (const init of [{ key: 'Home' }, { key: 'End' }, { key: 'End', ctrlKey: true }]) {
      window.dispatchEvent(new KeyboardEvent('keydown', init));
    }
    expect(seen).toEqual([]);
    off();
  });

  it('reads Space as the page does: Shift reverses it, and modifiers the browser ignores are ignored', () => {
    // Round 8 (TECH-013): Shift+Space scrolled back while this reported the next beat.
    const off = listen();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    for (const init of [
      { key: 'ArrowDown', shiftKey: true }, { key: 'PageDown', ctrlKey: true }, { key: 'ArrowUp', altKey: true },
      { key: 'PageUp', metaKey: true }, { key: ' ', ctrlKey: true },
    ]) window.dispatchEvent(new KeyboardEvent('keydown', init));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }));
    expect(seen).toEqual(['up', 'down', 'down']);
    off();
  });

  it('does not report a key a control already handled', () => {
    const off = listen();
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(seen).toEqual([]);
    off();
  });

  it('stops reporting once unsubscribed', () => {
    const off = listen();
    off();
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    expect(seen).toEqual([]);
  });

  it('reports only one start for an uninterrupted wheel wave', () => {
    const starts: ScrollDirection[] = [];
    let now = 1000;
    const time = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const off = subscribeScrollGesture(direction => starts.push(direction), { startsOnly: true });
    for (let i = 0; i < 80; i++) {
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200 }));
      now += 50;
    }
    expect(starts).toEqual(['down']);
    now += 300;
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -200 }));
    expect(starts).toEqual(['down', 'up']);
    off();
    time.mockRestore();
  });

  it('does not treat held scroll keys as fresh requests', () => {
    const starts: ScrollDirection[] = [];
    const off = subscribeScrollGesture(direction => starts.push(direction), { startsOnly: true });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true }));
    expect(starts).toEqual(['down']);
    off();
  });

  it('does not spend a wave start on sub-threshold trackpad motion', () => {
    const starts: ScrollDirection[] = [];
    const off = subscribeScrollGesture(direction => starts.push(direction), { startsOnly: true });
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    expect(starts).toEqual(['down']);
    off();
  });

  it('recognizes page-scroll keys while a navigation button has focus', () => {
    const off = listen();
    const button = document.createElement('button');
    document.body.append(button);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    expect(seen).toEqual(['down']);
    off();
  });

  it.each(['button', 'input', 'textarea', 'select'])('leaves %s keyboard interaction to the native control', (tag) => {
    const off = listen();
    const control = document.createElement(tag);
    document.body.append(control);
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    control.dispatchEvent(event);
    expect(seen).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    control.remove();
    off();
  });
});
