import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANDING_FRAME_CAP_MS, LANDING_WAIT_MS, cancelSectionLanding, landSectionFocus } from './sectionLanding';
import { publishSectionNavigation, subscribeSectionNavigation } from './sectionNavigation';

const frames: FrameRequestCallback[] = [];
let clock = 0;
/** Runs `count` animation frames `stepMs` apart on the test's clock. */
const flush = (count = 1, stepMs = 1000 / 60) => {
  for (let index = 0; index < count && frames.length; index++) frames.shift()!(clock += stepMs);
};

beforeEach(() => {
  document.body.innerHTML = `
    <nav><button id="projects-link">Projects</button></nav>
    <main><section id="contact" tabindex="-1" data-section-landing="contact"><a href="mailto:a@b.c">Email</a></section></main>
    <div id="stage" inert><div id="reader" tabindex="-1" data-section-landing="projects">Reader</div></div>`;
  frames.length = 0;
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
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

  it.each(['wheel', 'touchstart'])('gives way to a %s from the reader as well', type => {
    // Round 14 (TECH-045): only keys and presses ended the wait; a scroll gesture left it to land later.
    byId('projects-link').focus();
    landSectionFocus('projects');
    flush();
    document.dispatchEvent(new Event(type));
    byId('stage').removeAttribute('inert');
    flush(5);
    expect(byId('projects-link')).toHaveFocus();
    expect(frames).toHaveLength(0);
  });

  it('gives way to a newer navigation elsewhere, and keeps waiting through a repeat of its own', () => {
    byId('projects-link').focus();
    landSectionFocus('projects');
    flush();
    publishSectionNavigation('projects', { source: 'navbar' });
    expect(frames).toHaveLength(1);
    publishSectionNavigation('contact');
    byId('stage').removeAttribute('inert');
    flush(5);
    expect(byId('projects-link')).toHaveFocus();

    // Its own navigation, published while it starts, is not a newer one.
    byId('stage').setAttribute('inert', '');
    const stop = subscribeSectionNavigation(target => { if (target === 'projects') landSectionFocus('projects'); });
    publishSectionNavigation('projects', { source: 'navbar' });
    stop();
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).toHaveFocus();
  });

  it('is not given way by an older navigation still being delivered around the one that started it', () => {
    // Round 15: a navigation published from inside another's delivery started a landing that the outer one then cancelled.
    const stopOuter = subscribeSectionNavigation(target => { if (target === 'about') publishSectionNavigation('projects', { source: 'navbar' }); });
    const stopInner = subscribeSectionNavigation(target => { if (target === 'projects') landSectionFocus('projects'); });
    publishSectionNavigation('about', { source: 'navbar' });
    stopOuter();
    stopInner();
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).toHaveFocus();
  });

  it('waits through the TV turn on a fast display, then gives up rather than taking focus late', () => {
    // Round 9 (TECH-025): 60 frames were a second at 60 Hz, half that at 120 -- shorter than the 2.2s turn.
    landSectionFocus('projects');
    flush(Math.round(2.3 * 144), 1000 / 144);
    expect(frames).toHaveLength(1);
    byId('stage').removeAttribute('inert');
    flush(1, 1000 / 144);
    expect(byId('reader')).toHaveFocus();

    byId('projects-link').focus();
    byId('stage').setAttribute('inert', '');
    landSectionFocus('projects');
    flush(Math.ceil(LANDING_WAIT_MS / (1000 / 60)) + 1);
    expect(frames).toHaveLength(0);
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('projects-link')).toHaveFocus();
  });

  it('ages only by visible frames: a hidden tab or a stalled frame counts as one capped frame', () => {
    // Round 9 (TECH-026): a tab switch mid-turn, or a display painting every 150ms, outlived a wall clock.
    let hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    landSectionFocus('projects');
    hidden = true;
    flush(1, 8000);
    hidden = false;
    flush(46, 150);
    expect(frames).toHaveLength(1);
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).toHaveFocus();
  });

  it('does not age while its destination is still arriving, and lets go of an arrival that never ends', () => {
    byId('stage').setAttribute('data-section-owner', 'projects');
    byId('stage').setAttribute('data-arriving', 'true');
    landSectionFocus('projects');
    flush(Math.ceil((LANDING_WAIT_MS * 2) / 50), 50);
    expect(frames).toHaveLength(1);
    byId('stage').removeAttribute('data-arriving');
    byId('stage').removeAttribute('inert');
    flush();
    expect(byId('reader')).toHaveFocus();

    byId('projects-link').focus();
    byId('stage').setAttribute('inert', '');
    byId('stage').setAttribute('data-arriving', 'true');
    landSectionFocus('projects');
    flush(Math.ceil((LANDING_WAIT_MS * 4) / LANDING_FRAME_CAP_MS) + 1, LANDING_FRAME_CAP_MS);
    expect(frames).toHaveLength(0);
    expect(byId('projects-link')).toHaveFocus();
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
