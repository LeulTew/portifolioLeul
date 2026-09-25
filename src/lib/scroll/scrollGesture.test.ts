import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initScrollGesture,
  resetScrollGesture,
  subscribeScrollGesture,
  type ScrollDirection,
} from './scrollGesture';

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
