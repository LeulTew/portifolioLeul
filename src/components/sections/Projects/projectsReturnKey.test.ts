import { afterEach, describe, expect, it } from 'vitest';
import { projectsReturnKeyDelta } from './projectsReturnKey';

afterEach(() => document.body.replaceChildren());

const setup = () => {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'clientHeight', { value: 900 });
  scroller.scrollTop = 2000;
  const navbar = document.createElement('button');
  document.body.append(navbar, scroller);
  return { scroller, navbar };
};
const delta = (target: HTMLElement, scroller: HTMLElement, key: string, options: KeyboardEventInit = {}) => {
  let movement = Number.NaN;
  const read = (event: KeyboardEvent) => { movement = projectsReturnKeyDelta(event, scroller); };
  target.addEventListener('keydown', read, { passive: true });
  const event = new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  target.removeEventListener('keydown', read);
  expect(event.defaultPrevented).toBe(false);
  return movement;
};

describe('Projects-only keyboard/native scrollport bridge', () => {
  it('has an explicit, bounded ArrowUp/PageUp/Home distance policy without touching focus', () => {
    const { navbar, scroller } = setup();
    navbar.focus();
    expect(delta(navbar, scroller, 'ArrowUp')).toBe(-40);
    expect(delta(navbar, scroller, 'PageUp')).toBe(-810);
    expect(delta(navbar, scroller, 'Home')).toBe(-2000);
    expect(delta(navbar, scroller, 'ArrowDown')).toBe(0);
    expect(navbar).toHaveFocus();
  });

  it('never doubles native scrolling from descendants of the actual scrollport', () => {
    const { scroller } = setup();
    const link = document.createElement('a');
    scroller.append(link);
    expect(delta(link, scroller, 'ArrowUp')).toBe(0);
    expect(delta(link, scroller, 'PageUp')).toBe(0);
    expect(delta(link, scroller, 'Home')).toBe(0);
  });

  it.each(['input', 'textarea', 'select', '[contenteditable]', '[data-projects-display]', '[data-projects-tabs]', '[role="slider"]'])(
    'preserves native/control ownership for %s', selector => {
      const { scroller } = setup();
      const target = document.createElement(selector.startsWith('[') ? 'div' : selector);
      if (selector.startsWith('[')) {
        const [name, value] = selector.slice(1, -1).replaceAll('"', '').split('=');
        target.setAttribute(name, value ?? '');
      }
      document.body.append(target);
      expect(delta(target, scroller, 'ArrowUp')).toBe(0);
      expect(delta(target, scroller, 'PageUp')).toBe(0);
    },
  );

  it('does not reinterpret modified browser or platform shortcuts', () => {
    const { navbar, scroller } = setup();
    for (const options of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) {
      expect(delta(navbar, scroller, 'Home', options)).toBe(0);
    }
  });
});
