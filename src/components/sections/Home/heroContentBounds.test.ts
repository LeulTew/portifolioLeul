import { afterEach, describe, expect, it } from 'vitest';
import { cloudBounds, measureHeroContent } from './heroContentBounds';

afterEach(() => { document.body.replaceChildren(); });

function box(element: HTMLElement, parent: HTMLElement, left: number, top: number, width: number, height: number) {
  parent.appendChild(element);
  Object.defineProperties(element, {
    offsetParent: { value: parent },
    offsetLeft: { value: left },
    offsetTop: { value: top },
    offsetWidth: { value: width },
    offsetHeight: { value: height },
  });
  return element;
}

describe('the cloud follows actual hero content', () => {
  it('covers text and buttons, not the empty width of their flex row', () => {
    const content = document.createElement('div');
    document.body.appendChild(content);
    const text = box(document.createElement('p'), content, 100, 60, 480, 200);
    text.dataset.cueLayer = 'description';
    const actions = box(document.createElement('div'), content, 100, 320, 1100, 48);
    actions.dataset.cueLayer = 'actions';
    box(document.createElement('button'), actions, 0, 0, 224, 48);
    box(document.createElement('button'), actions, 242, 0, 160, 48);
    const measured = measureHeroContent(content)!;
    expect(measured).toEqual({ left: 100, top: 60, right: 580, bottom: 368, width: 480, height: 308 });
    const cloud = cloudBounds(measured);
    expect(cloud.left).toBeLessThan(measured.left);
    expect(cloud.top).toBeLessThan(measured.top);
    expect(cloud.left + cloud.width).toBeGreaterThan(measured.right);
    expect(cloud.top + cloud.height).toBeGreaterThan(measured.bottom);
    expect(cloud.width).toBeLessThan(actions.offsetWidth);
  });

  it('keeps stable bounds while the content animates out', () => {
    const content = document.createElement('div');
    document.body.appendChild(content);
    const title = box(document.createElement('h1'), content, 120, 30, 450, 80);
    title.dataset.cueLayer = 'title';
    const initial = measureHeroContent(content);
    title.style.transform = 'translateY(-50px) scale(0.5)';
    title.style.opacity = '0';
    expect(measureHeroContent(content)).toEqual(initial);
  });

  it('waits for layout instead of measuring an empty page', () => {
    expect(measureHeroContent(document.createElement('div'))).toBeNull();
  });
});
