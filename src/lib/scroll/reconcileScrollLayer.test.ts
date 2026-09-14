import { describe, expect, it, vi } from 'vitest';
import { reconcileScrollLayer } from './reconcileScrollLayer';

function setup() {
  const el = document.createElement('div');
  const readHeight = vi.fn(() => 9900);
  Object.defineProperties(el, {
    clientHeight: { value: 900 },
    scrollHeight: { get: readHeight },
  });
  const fixed = document.createElement('div');
  const html = document.createElement('div');
  fixed.appendChild(html);
  const offset = 0.31415926535;
  el.scrollTop = offset * 9000;
  return { el, fixed, html, offset, delta: 0, eps: 0.00001, pages: 10, readHeight };
}

describe('settled scroll layer reconciliation', () => {
  it('does not remeasure or republish an idle CSSOM-rounded transform every frame', () => {
    const scroll = setup();
    let serialized = '';
    const write = vi.fn((value: string) => {
      serialized = value.replace(/-?\d+\.\d+/g, part => Number(part).toFixed(2));
    });
    Object.defineProperty(scroll.html.style, 'transform', {
      configurable: true,
      get: () => serialized,
      set: write,
    });
    expect(reconcileScrollLayer(scroll, 900)).toBe(true);
    for (let frame = 0; frame < 180; frame++) {
      expect(reconcileScrollLayer(scroll, 900)).toBe(false);
    }
    expect(write).toHaveBeenCalledOnce();
    expect(scroll.readHeight).toHaveBeenCalledOnce();
  });

  it('still repairs externally changed HTML and viewport geometry', () => {
    const scroll = setup();
    reconcileScrollLayer(scroll, 900);
    scroll.html.style.transform = 'translate3d(0px, -50px, 0px)';
    expect(reconcileScrollLayer(scroll, 900)).toBe(true);
    expect(reconcileScrollLayer(scroll, 768)).toBe(true);
    expect(scroll.html.style.transform).toContain(String(-768 * 9 * scroll.offset));
  });

  it('never takes over moving frames or an unfinished physical restore', () => {
    const scroll = setup();
    scroll.delta = 0.1;
    expect(reconcileScrollLayer(scroll, 900)).toBe(false);
    expect(scroll.readHeight).not.toHaveBeenCalled();
    scroll.delta = 0;
    scroll.el.scrollTop = 0;
    expect(reconcileScrollLayer(scroll, 900)).toBe(false);
    expect(scroll.html.style.transform).toBe('');
  });
});
