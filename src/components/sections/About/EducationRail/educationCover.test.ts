// @vitest-environment happy-dom
// JSDOM drops visibility priorities; restoration needs a conforming CSSOM.
import { afterEach, describe, expect, it } from 'vitest';
import { coverEducationBackground } from './educationCover';

afterEach(() => { document.body.replaceChildren(); });

function setup() {
  const container = document.createElement('div');
  const html = document.createElement('div');
  const main = document.createElement('main');
  const host = document.createElement('div');
  const stage = document.createElement('div');
  const overlay = document.createElement('div');
  overlay.dataset.pinnedSequence = 'true';
  overlay.style.setProperty('visibility', 'visible', 'important');
  main.appendChild(host);
  html.appendChild(main);
  container.appendChild(html);
  document.body.append(container, overlay, stage);
  return { container, html, main, host, stage, overlay };
}

describe('opaque Education cover', () => {
  it('hides composited content and old overlays while keeping the native scrollport available', () => {
    const { container, html, host, stage, overlay } = setup();
    container.style.overflowY = 'auto';
    Object.defineProperties(container, {
      scrollHeight: { value: 5000 },
      clientHeight: { value: 900 },
    });
    html.style.transform = 'translate3d(0px, -1000px, 0px)';
    const restore = coverEducationBackground(host, stage);
    expect(html.style.visibility).toBe('hidden');
    expect(overlay.style.visibility).toBe('hidden');
    expect(html.hasAttribute('data-education-covered')).toBe(true);
    expect(overlay.hasAttribute('data-education-covered')).toBe(true);
    expect(container.hasAttribute('data-education-covered')).toBe(false);
    expect(stage.hasAttribute('data-education-covered')).toBe(false);
    expect(container.style.visibility).toBe('');
    expect(stage.style.visibility).toBe('');
    expect(html.style.transform).toBe('translate3d(0px, -1000px, 0px)');
    expect(html.style.display).toBe('');
    restore();
    restore();
    expect(html.style.visibility).toBe('');
    expect(overlay.style.visibility).toBe('visible');
    expect(html.hasAttribute('data-education-covered')).toBe(false);
    expect(overlay.hasAttribute('data-education-covered')).toBe(false);
    expect(overlay.style.getPropertyPriority('visibility')).toBe('important');
  });

  it('covers only main content in the ordinary document flow', () => {
    const { html, main, host, stage } = setup();
    const restore = coverEducationBackground(host, stage);
    expect(main.style.visibility).toBe('hidden');
    expect(html.style.visibility).toBe('');
    expect(document.body.style.visibility).toBe('');
    restore();
    expect(main.style.visibility).toBe('');
  });

  it('never hides a parent containing the Education stage', () => {
    const { main, host, stage } = setup();
    main.appendChild(stage);
    const restore = coverEducationBackground(host, stage);
    expect(main.style.visibility).toBe('');
    expect(main.hasAttribute('data-education-covered')).toBe(false);
    restore();
  });

  it('restores an existing cover marker without retaining its own pause', () => {
    const { main, host, stage, overlay } = setup();
    main.dataset.educationCovered = 'existing';
    const restore = coverEducationBackground(host, stage);
    expect(main.dataset.educationCovered).toBe('');
    expect(overlay.dataset.educationCovered).toBe('');
    restore();
    expect(main.dataset.educationCovered).toBe('existing');
    expect(overlay.hasAttribute('data-education-covered')).toBe(false);
  });
});
