import { describe, expect, it, vi } from 'vitest';
import { settleScrollPosition } from './settleScrollPosition';
import { subscribeScrollProgress } from './scrollProgress';

function setup() {
  const el = document.createElement('div');
  Object.defineProperties(el, {
    clientHeight: { value: 900 },
    scrollHeight: { value: 9900 },
  });
  const fixed = document.createElement('div');
  const html = document.createElement('div');
  fixed.appendChild(html);
  html.style.transform = 'translate3d(0px, -6000px, 0px)';
  return { el, fixed, html, offset: 0.8, delta: 0.2, pages: 10 };
}

describe('completed chapter scroll settlement', () => {
  it.each([0.2, 0.7])('aligns physical, damped and rendered positions together at %s', (offset) => {
    const scroll = setup();
    const native = vi.fn();
    const changed = vi.fn();
    scroll.el.addEventListener('scroll', native);
    const unsubscribe = subscribeScrollProgress(changed);
    try {
      settleScrollPosition(scroll, offset);
      expect(scroll.el.scrollTop).toBe(offset * 9000);
      expect(native).toHaveBeenCalledOnce();
      expect(scroll.offset).toBeCloseTo(offset);
      expect(scroll.delta).toBe(0);
      expect(scroll.html.style.transform).toBe(`translate3d(0px, ${-8100 * offset}px, 0px)`);
      expect(changed).toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('does not retain control over subsequent native scrolling', () => {
    const scroll = setup();
    const request = vi.spyOn(window, 'requestAnimationFrame');
    settleScrollPosition(scroll, 0.5);
    scroll.el.scrollTop += 100;
    scroll.el.dispatchEvent(new Event('scroll'));
    expect(scroll.el.scrollTop).toBe(4600);
    expect(request).not.toHaveBeenCalled();
  });
});
