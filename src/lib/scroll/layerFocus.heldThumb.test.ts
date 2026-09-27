// Rounds 25-27 (TECH-071/076): a Tab reveal inside a portalled reader under a held thumb is the page's own, not a gesture.
import { expect, it, vi } from 'vitest';
import { installLayerFocus } from '@/lib/scroll/layerFocus';
import { resetScrollGesture, subscribeScrollGesture } from '@/lib/scroll/scrollGesture';

it('a Tab reveal within the held portalled reader is owned, not a scroll gesture', () => {
  resetScrollGesture();
  document.body.innerHTML = `<div id="track"><main id="main"><section id="projects"></section></main></div>
    <div id="panel" data-section-owner="projects" style="overflow-y:auto"><button id="picker">Picker</button><a id="source" href="#source">Source</a></div>`;
  const el = (id: string) => document.getElementById(id)!;
  const panel = el('panel');
  Object.defineProperties(panel, {
    clientWidth: { value: 500 }, clientLeft: { value: 0 }, clientHeight: { value: 100 }, scrollHeight: { value: 400 },
  });
  const rects: Record<string, DOMRect> = {
    track: DOMRect.fromRect({ width: 600, height: 800 }),
    main: DOMRect.fromRect({ width: 600, height: 800 }),
    projects: DOMRect.fromRect({ width: 600, height: 800 }),
    panel: DOMRect.fromRect({ x: 0, y: 100, width: 508, height: 100 }),
    picker: DOMRect.fromRect({ x: 10, y: 110, width: 80, height: 20 }),
    source: DOMRect.fromRect({ x: 10, y: 240, width: 80, height: 20 }),
  };
  for (const [id, rect] of Object.entries(rects)) {
    el(id).getBoundingClientRect = () => rect;
    el(id).getClientRects = () => [rect] as unknown as DOMRectList;
  }
  const stopFocus = installLayerFocus({ track: el('track'), main: () => el('main'), navigate: vi.fn() });
  const seen = vi.fn();
  const off = subscribeScrollGesture(seen);
  try {
    el('picker').focus({ preventScroll: true });
    panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX: 504, clientY: 115 }));
    el('picker').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(el('source'));
    expect(panel.scrollTop).toBe(0);
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    expect(panel.scrollTop).toBeGreaterThan(0);
    panel.dispatchEvent(new Event('scroll'));
    expect(seen).not.toHaveBeenCalled();
  } finally {
    stopFocus(); off(); resetScrollGesture(); document.body.replaceChildren(); vi.restoreAllMocks();
  }
});

it('shows the stop focused last after several Tabs under a held thumb, measured when it runs', () => {
  // Round 27 (TECH-076): each deferred reveal added a shift measured against a page the ones before it
  // had not moved yet, and the focused link ended out of sight.
  resetScrollGesture();
  document.body.innerHTML = `<div id="track"><main id="main"><section id="projects"></section></main></div>
    <div id="panel" data-section-owner="projects" style="overflow-y:auto"><button id="picker">Picker</button><a id="one" href="#one">One</a><a id="two" href="#two">Two</a></div>`;
  const el = (id: string) => document.getElementById(id)!;
  const panel = el('panel');
  Object.defineProperties(panel, {
    clientWidth: { value: 500 }, clientLeft: { value: 0 }, clientHeight: { value: 100 }, scrollHeight: { value: 400 },
  });
  // Content positions inside the 100px panel at viewport y=100; the panel's scroll moves them.
  const content: Record<string, number> = { picker: 10, one: 160, two: 240 };
  el('track').getBoundingClientRect = () => DOMRect.fromRect({ width: 600, height: 800 });
  el('main').getBoundingClientRect = () => DOMRect.fromRect({ width: 600, height: 800 });
  el('projects').getBoundingClientRect = () => DOMRect.fromRect({ width: 600, height: 800 });
  panel.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 100, width: 508, height: 100 });
  for (const [id, y] of Object.entries(content)) {
    const rect = () => DOMRect.fromRect({ x: 10, y: 100 + y - panel.scrollTop, width: 80, height: 20 });
    el(id).getBoundingClientRect = rect;
    el(id).getClientRects = () => [rect()] as unknown as DOMRectList;
  }
  const stopFocus = installLayerFocus({ track: el('track'), main: () => el('main'), navigate: vi.fn() });
  try {
    el('picker').focus({ preventScroll: true });
    panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, clientX: 504, clientY: 115 }));
    el('picker').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    el('one').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(el('two'));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    const shown = el('two').getBoundingClientRect();
    expect(shown.top).toBeGreaterThanOrEqual(100);
    expect(shown.bottom).toBeLessThanOrEqual(200);
  } finally {
    stopFocus(); resetScrollGesture(); document.body.replaceChildren(); vi.restoreAllMocks();
  }
});
