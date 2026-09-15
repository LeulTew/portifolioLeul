// @vitest-environment happy-dom
// JSDOM drops visibility priorities; restoration needs a conforming CSSOM.
import { afterEach, describe, expect, it } from 'vitest';
import { coverChapterBackground, coverEducationBackground } from './educationCover';

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

describe.each(['education', 'skills'] as const)('opaque %s cover', owner => {
  const attribute = `data-${owner}-covered`;

  it('hides composited content and old overlays while keeping the native scrollport available', () => {
    const { container, html, host, stage, overlay } = setup();
    container.style.overflowY = 'auto';
    Object.defineProperties(container, {
      scrollHeight: { value: 5000 },
      clientHeight: { value: 900 },
    });
    html.style.transform = 'translate3d(0px, -1000px, 0px)';
    const restore = coverChapterBackground(host, stage, owner);
    expect(html.style.visibility).toBe('hidden');
    expect(overlay.style.visibility).toBe('hidden');
    expect(html.hasAttribute(attribute)).toBe(true);
    expect(overlay.hasAttribute(attribute)).toBe(true);
    expect(container.hasAttribute(attribute)).toBe(false);
    expect(stage.hasAttribute(attribute)).toBe(false);
    expect(container.style.visibility).toBe('');
    expect(stage.style.visibility).toBe('');
    expect(html.style.transform).toBe('translate3d(0px, -1000px, 0px)');
    expect(html.style.display).toBe('');
    restore();
    restore();
    expect(html.style.visibility).toBe('');
    expect(overlay.style.visibility).toBe('visible');
    expect(html.hasAttribute(attribute)).toBe(false);
    expect(overlay.hasAttribute(attribute)).toBe(false);
    expect(overlay.style.getPropertyPriority('visibility')).toBe('important');
  });

  it('covers only main content in the ordinary document flow', () => {
    const { html, main, host, stage } = setup();
    const restore = coverChapterBackground(host, stage, owner);
    expect(main.style.visibility).toBe('hidden');
    expect(html.style.visibility).toBe('');
    expect(document.body.style.visibility).toBe('');
    restore();
    expect(main.style.visibility).toBe('');
  });

  it('never hides a parent containing the active stage', () => {
    const { main, host, stage } = setup();
    main.appendChild(stage);
    const restore = coverChapterBackground(host, stage, owner);
    expect(main.style.visibility).toBe('');
    expect(main.hasAttribute(attribute)).toBe(false);
    restore();
  });

  it('restores an existing cover marker without retaining its own pause', () => {
    const { main, host, stage, overlay } = setup();
    main.setAttribute(attribute, 'existing');
    const restore = coverChapterBackground(host, stage, owner);
    expect(main.getAttribute(attribute)).toBe('');
    expect(overlay.getAttribute(attribute)).toBe('');
    restore();
    expect(main.getAttribute(attribute)).toBe('existing');
    expect(overlay.hasAttribute(attribute)).toBe(false);
  });
});

it('preserves the Education entry point and its default owner', () => {
  const { host, stage, main } = setup();
  expect(coverEducationBackground).toBe(coverChapterBackground);
  const restore = coverEducationBackground(host, stage);
  expect(main.hasAttribute('data-education-covered')).toBe(true);
  expect(main.hasAttribute('data-skills-covered')).toBe(false);
  restore();
});
