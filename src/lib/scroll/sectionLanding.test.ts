import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelSectionLanding, landSectionFocus } from './sectionLanding';

const frames: FrameRequestCallback[] = [];
const flush = (count = 1) => {
  for (let index = 0; index < count && frames.length; index++) frames.shift()!(performance.now());
};

beforeEach(() => {
  document.body.innerHTML = `
    <nav><button id="projects-link">Projects</button></nav>
    <main><section id="contact" tabindex="-1" data-section-landing="contact"><a href="mailto:a@b.c">Email</a></section></main>
    <div id="stage" inert><div id="reader" tabindex="-1" data-section-landing="projects">Reader</div></div>`;
  frames.length = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => { frames.length = 0; });
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
afterEach(() => {
  cancelSectionLanding();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const byId = (id: string) => document.getElementById(id)!;

describe('landing focus after navigation', () => {
  it('moves focus to the section landing at once when it can take focus', () => {
    byId('projects-link').focus();
    landSectionFocus('contact');
    expect(byId('contact')).toHaveFocus();
    expect(frames).toHaveLength(0);
  });

  it('waits for a landing that is inert while its chapter settles', () => {
    landSectionFocus('projects');
    expect(frames).toHaveLength(1);
    flush(3);
    expect(byId('reader')).not.toHaveFocus();
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).toHaveFocus();
    expect(frames).toHaveLength(0);
  });

  it('gives way to the reader: any key or pointer press ends the wait', () => {
    landSectionFocus('projects');
    flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    byId('stage').removeAttribute('inert');
    flush(5);
    expect(byId('reader')).not.toHaveFocus();

    byId('stage').setAttribute('inert', '');
    landSectionFocus('projects');
    document.dispatchEvent(new Event('pointerdown'));
    byId('stage').removeAttribute('inert');
    flush(5);
    expect(byId('reader')).not.toHaveFocus();
  });

  it('gives up after about a second rather than taking focus late', () => {
    landSectionFocus('projects');
    flush(59);
    expect(frames).toHaveLength(0);
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).not.toHaveFocus();
  });

  it('keeps only the latest navigation', () => {
    landSectionFocus('projects');
    byId('stage').removeAttribute('inert');
    byId('reader').setAttribute('hidden', '');
    landSectionFocus('contact');
    byId('reader').removeAttribute('hidden');
    flush(5);
    expect(byId('contact')).toHaveFocus();
  });

  it('does nothing for a section without a landing', () => {
    byId('projects-link').focus();
    landSectionFocus('skills');
    expect(frames).toHaveLength(0);
    expect(byId('projects-link')).toHaveFocus();
  });

  it('takes the first candidate that can take focus: the screen, else its scene control', () => {
    const control = document.createElement('button');
    control.id = 'scene-next';
    control.dataset.sectionLanding = 'projects';
    control.disabled = true;
    document.body.append(control);
    landSectionFocus('projects');
    expect(document.activeElement).not.toBe(control);
    control.disabled = false;
    flush();
    expect(control).toHaveFocus();
    // Once the screen can be read, it is preferred.
    byId('stage').removeAttribute('inert');
    landSectionFocus('projects');
    expect(byId('reader')).toHaveFocus();
  });

  it('abandons a waiting landing on request', () => {
    landSectionFocus('projects');
    cancelSectionLanding();
    byId('stage').removeAttribute('inert');
    flush(5);
    expect(byId('reader')).not.toHaveFocus();
  });
});
