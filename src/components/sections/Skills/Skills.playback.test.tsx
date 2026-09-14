import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { Skills } from './Skills';
import { SKILL_CHAPTERS, SKILLS_STAGE_QUERY } from './skillsData';
import { getMaterialGeometry } from './skillGeometry';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { getOverlayOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';

let top = 1200;
let publication = 0;
let frameId = 0;
let staged = true;
let reduced = false;
const frames = new Map<number, FrameRequestCallback>();
const mediaListeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
const originalRect = Element.prototype.getBoundingClientRect;

const stage = () => screen.getByTestId('skills-stage');
const index = () => Number(stage().dataset.activeSkill);
const next = () => screen.getByRole('button', { name: /^Next:/ });

// Behavioral cases exercise the 50ms visible-frame ceiling; pacing cases use 16ms.
function advance(ms: number, interval = 50) {
  let remaining = ms;
  while (remaining > 0) {
    if (frames.size === 0) {
      act(() => vi.advanceTimersByTime(remaining));
      gsap.ticker.sleep();
      return;
    }
    const delta = Math.min(interval, remaining);
    act(() => {
      vi.advanceTimersByTime(delta);
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(performance.now()));
    });
    gsap.ticker.sleep();
    remaining -= delta;
  }
}

function place(value: number) {
  top = value;
  act(() => setScrollProgress(++publication / 100));
  gsap.ticker.sleep();
}

function wheel(deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  gsap.ticker.sleep();
}

function mount(onNavigate?: (section: string) => void) {
  render(<>
    <button type="button">Navigation utility</button>
    <main data-testid="underlay">
      <button type="button">Background action</button>
      <Skills onNavigate={onNavigate} />
    </main>
  </>);
  gsap.ticker.sleep();
}

function enter(onNavigate?: (section: string) => void) {
  mount(onNavigate);
  place(80);
  advance(3100);
  expect(next()).toBeEnabled();
}

function cross() {
  fireEvent.click(next());
  advance(3300);
}

beforeEach(() => {
  top = 1200;
  publication = 0;
  frameId = 0;
  staged = true;
  reduced = false;
  frames.clear();
  mediaListeners.clear();
  resetScrollProgress();
  resetScrollGesture();
  resetCameraHold();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() {
      return query === SKILLS_STAGE_QUERY ? staged : query === '(prefers-reduced-motion: reduce)' && reduced;
    },
    media: query,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
      if (!mediaListeners.has(query)) mediaListeners.set(query, new Set());
      mediaListeners.get(query)!.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
      mediaListeners.get(query)?.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.id === 'skills') return DOMRect.fromRect({ x: 0, y: top, width: 1440, height: 4320 });
    return originalRect.call(this);
  });
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  gsap.ticker.sleep();
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  frames.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Skills completed-beat playback', () => {
  it('does not animate offscreen or expose a hidden portal to assistive technology', () => {
    mount();
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(stage()).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('skills')).not.toHaveAttribute('data-skills-active');
    expect(getOverlayOcclusion()).toBe(false);
  });

  it('arrives at the existing navigation inset and reads all of the first chapter', () => {
    enter();
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(stage()).not.toHaveAttribute('aria-hidden');
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 6: Languages');
    expect(document.getElementById('skills')).toHaveAttribute('data-skills-active', 'true');
    expect(getOverlayOcclusion()).toBe(true);
  });

  it.each([40, 20000])('takes the same complete entry and reading time for a %ipx scroll', delta => {
    mount();
    place(80);
    wheel(delta);
    advance(1750, 16);
    expect(stage()).toHaveAttribute('data-phase', 'entering');
    advance(100, 16);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(next()).toBeDisabled();
    advance(1160, 16);
    expect(next()).toBeDisabled();
    advance(40, 16);
    expect(next()).toBeEnabled();
  });

  it('does not spend scroll distance when using its controls', () => {
    enter();
    fireEvent.click(next());
    expect(index()).toBe(1);
    expect(next()).toBeDisabled();
    expect(window.scrollBy).not.toHaveBeenCalled();
    advance(1950);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    advance(100);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(next()).toBeDisabled();
    advance(1250);
    expect(next()).toBeEnabled();
  });

  it('discards input during movement and rest, and requires a new momentum wave', () => {
    enter();
    wheel(500);
    expect(index()).toBe(1);
    for (let count = 0; count < 90; count++) {
      advance(50);
      wheel(500);
    }
    expect(index()).toBe(1);
    expect(next()).toBeEnabled();
    advance(251);
    wheel(500);
    expect(index()).toBe(2);
  });

  it('does not queue a direction reversal or button click while crossing', () => {
    enter();
    fireEvent.click(next());
    fireEvent.click(next());
    wheel(-500);
    advance(3300);
    expect(index()).toBe(1);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
  });

  it('retraces the same score in reverse and restores the original artifact', () => {
    enter();
    const sculpture = stage().querySelector('[data-skill-sculpture]')!;
    const initial = [...sculpture.querySelectorAll('path')].map(path => path.getAttribute('d'));
    cross();
    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }));
    advance(3300);
    expect(index()).toBe(0);
    expect(screen.getByRole('heading', { name: 'Languages' })).toBeVisible();
    expect(stage().querySelector('[data-skill-sculpture]')).toBe(sculpture);
    expect([...sculpture.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(initial);
    expect(stage().querySelector('[data-skill-chapter="1"]')).toHaveStyle({ visibility: 'hidden' });
  });

  it('morphs the same visible material while its depth layers move at different rates', () => {
    enter();
    const sculpture = stage().querySelector('[data-skill-sculpture]')!;
    const shell = sculpture.querySelector('[data-material-shell]')!;
    const body = sculpture.querySelector('[data-material-body]')!;
    const floor = sculpture.querySelector('[data-material-floor]')!;
    const foreground = sculpture.querySelector('[data-material-foreground]')!;
    const before = shell.getAttribute('d');
    fireEvent.click(next());
    for (let sample = 0; sample < 3; sample++) {
      advance(350);
      expect(stage().querySelector('[data-skill-sculpture]')).toBe(sculpture);
      expect(Number(gsap.getProperty(body, 'opacity'))).toBe(1);
      expect(shell.getAttribute('d')).not.toBe(before);
    }
    expect(Math.abs(Number(gsap.getProperty(floor, 'x')) - Number(gsap.getProperty(foreground, 'x'))))
      .toBeGreaterThan(20);
    advance(2250);
    expect(shell.getAttribute('d')).toBe(getMaterialGeometry('interfaces').shell);
    expect(Number(gsap.getProperty(stage().querySelector('[data-skill-rig]')!, 'xPercent'))).toBe(-25);
  });

  it('does not label an outgoing heading with a destination chapter number', () => {
    enter();
    fireEvent.click(next());
    advance(300);
    const progress = screen.getByRole('list', { name: 'Skills chapters' });
    expect(progress.querySelector('[aria-current="step"]')).toHaveAttribute('aria-label', 'Languages');
    advance(1800);
    expect(progress.querySelector('[aria-current="step"]')).toHaveAttribute('aria-label', 'Frameworks & Web');
  });
  it('holds an unfinished sequence even after a flick spends its entire spacer', () => {
    enter();
    place(-20000);
    wheel(10000);
    advance(10000);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(index()).toBe(1);
    expect(getOverlayOcclusion()).toBe(true);
  });

  it('keeps every skill group until a separate final exit and aligns button-only navigation', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let count = 1; count < SKILL_CHAPTERS.length; count++) {
      cross();
      expect(index()).toBe(count);
      expect(screen.getByRole('heading', { name: SKILL_CHAPTERS[count].title })).toBeVisible();
    }
    expect(stage()).toHaveAttribute('data-visible', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'See projects' }));
    expect(getOverlayOcclusion()).toBe(false);
    advance(650);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('projects');
    expect(document.getElementById('skills')).not.toHaveAttribute('data-skills-active');
  });

  it('does not drag a reader back after a natural exit beyond the spacer', () => {
    const navigate = vi.fn();
    enter(navigate);
    for (let count = 1; count < SKILL_CHAPTERS.length; count++) cross();
    place(-20000);
    wheel(500);
    advance(650);
    expect(navigate).not.toHaveBeenCalled();
    expect(stage()).toHaveAttribute('data-phase', 'outside');
  });

  it('reenters the last completed chapter from below and supports reverse reading', () => {
    enter();
    for (let count = 1; count < SKILL_CHAPTERS.length; count++) cross();
    place(-10000);
    wheel(500);
    advance(650);
    place(-3300);
    wheel(-500);
    advance(1900);
    expect(index()).toBe(5);
    expect(screen.getByRole('button', { name: 'See projects' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }));
    advance(3300);
    expect(index()).toBe(4);
  });

  it('releases back to About only after reversing the first entrance', () => {
    const navigate = vi.fn();
    enter(navigate);
    fireEvent.click(screen.getByRole('button', { name: 'Back to About' }));
    advance(1000);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(navigate).not.toHaveBeenCalled();
    advance(900);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('about');
  });

  it('hands natural reverse to Education instead of jumping past it to About', () => {
    const navigate = vi.fn();
    enter(navigate);
    wheel(-500);
    advance(1900);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(navigate).not.toHaveBeenCalled();
    expect(window.scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 80 - 900, behavior: 'auto' });
  });

  it('does not reclaim Skills while a reverse boundary alignment is still damping', () => {
    enter();
    wheel(-500);
    advance(1900);
    place(40);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(stage()).not.toHaveAttribute('data-visible');
    advance(300);
    wheel(500);
    advance(3100);
    expect(next()).toBeEnabled();
  });

  it('honors global navigation after the current movement and full reading pause', () => {
    const navigate = vi.fn();
    enter(navigate);
    fireEvent.click(next());
    act(() => publishSectionNavigation('contact'));
    advance(3000);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    advance(900);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(navigate).not.toHaveBeenCalled();
    place(-20000);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
  });

  it('does not intercept a global jump that passes Skills', () => {
    mount();
    act(() => publishSectionNavigation('contact'));
    place(-10000);
    advance(5000);
    wheel(200);
    expect(stage()).not.toHaveAttribute('data-visible');
    act(() => publishSectionNavigation('skills'));
    place(80);
    advance(3100);
    expect(next()).toBeEnabled();
    expect(index()).toBe(0);
  });

  it('waits for Education to release ownership, including when scroll has stopped', async () => {
    const about = document.createElement('section');
    about.id = 'about';
    about.dataset.titleSettled = 'true';
    about.dataset.educationActive = 'true';
    document.body.appendChild(about);
    mount();
    place(-10000);
    advance(5000);
    expect(stage()).not.toHaveAttribute('data-visible');
    await act(async () => { about.removeAttribute('data-education-active'); });
    advance(3100);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    about.remove();
  });

  it('does not let a natural flick preempt About or Education before either has claimed its stage', async () => {
    const about = document.createElement('section');
    about.id = 'about';
    const education = document.createElement('div');
    education.dataset.testid = 'education-rail';
    education.dataset.staged = 'true';
    about.appendChild(education);
    document.body.appendChild(about);
    mount();
    place(-20000);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    await act(async () => { about.dataset.titleSettled = 'true'; });
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    await act(async () => { about.dataset.educationReleased = 'true'; });
    advance(3100);
    expect(next()).toBeEnabled();
    expect(index()).toBe(0);
  });

  it('does not let ignored momentum cancel a pending explicit navigation', () => {
    enter();
    fireEvent.click(next());
    act(() => publishSectionNavigation('contact'));
    wheel(500);
    advance(2300);
    wheel(-500);
    advance(1600);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(stage()).toHaveAttribute('data-phase', 'outside');
  });

  it('honors a new Skills destination after an already running exit finishes', () => {
    const navigate = vi.fn();
    enter(navigate);
    act(() => publishSectionNavigation('contact'));
    advance(300);
    act(() => publishSectionNavigation('skills'));
    advance(3500);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(next()).toBeEnabled();
    expect(index()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('enters the last chapter when returning from a global jump that skipped Skills entirely', () => {
    mount();
    act(() => publishSectionNavigation('contact'));
    place(-10000);
    place(-3300);
    wheel(-500);
    advance(1900);
    expect(index()).toBe(5);
    expect(screen.getByRole('button', { name: 'See projects' })).toBeEnabled();
  });

  it('wakes on a late About portal release after the final About flag and last scroll event', async () => {
    const about = document.createElement('section');
    about.id = 'about';
    document.body.appendChild(about);
    mount();
    const overlay = document.createElement('div');
    overlay.dataset.pinnedSequence = 'true';
    overlay.dataset.active = 'true';
    document.body.appendChild(overlay);
    place(80);
    await act(async () => { about.dataset.titleSettled = 'true'; });
    expect(stage()).not.toHaveAttribute('data-visible');
    await act(async () => { overlay.dataset.active = 'false'; });
    advance(3100);
    expect(next()).toBeEnabled();
    overlay.remove();
    about.remove();
  });

  it('does not advance a movement or its reading pause while the tab is hidden', () => {
    mount();
    place(80);
    advance(400);
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(10000);
    expect(stage()).toHaveAttribute('data-phase', 'entering');
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(1500);
    expect(next()).toBeDisabled();
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(10000);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(1100);
    expect(next()).toBeDisabled();
    advance(150);
    expect(next()).toBeEnabled();
  });

  it('caps a stalled paint rather than completing an unseen movement', () => {
    mount();
    place(80);
    advance(10000, 10000);
    expect(stage()).toHaveAttribute('data-phase', 'entering');
    advance(1750);
    expect(stage()).toHaveAttribute('data-phase', 'entering');
    advance(100);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
  });

  it('does no idle DOM writes after a chapter settles', async () => {
    enter();
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver(records => writes.push(...records));
    observer.observe(stage(), { subtree: true, attributes: true, childList: true, characterData: true });
    advance(5000);
    await act(async () => {});
    observer.disconnect();
    expect(writes.map(record => ({
      type: record.type,
      attribute: record.attributeName,
      target: record.target instanceof Element ? record.target.outerHTML.slice(0, 260) : record.target.nodeName,
    }))).toEqual([]);
  });

  it('releases ownership and restores a complete static list on a live reduced-motion change', () => {
    enter();
    reduced = true;
    act(() => mediaListeners.get('(prefers-reduced-motion: reduce)')
      ?.forEach(listener => listener({ matches: true })));
    expect(stage()).toHaveAttribute('data-staged', 'false');
    expect(document.getElementById('skills')).not.toHaveAttribute('data-skills-active');
    expect(getOverlayOcclusion()).toBe(false);
    SKILL_CHAPTERS.forEach(chapter => {
      expect(screen.getByRole('heading', { name: chapter.title })).toBeVisible();
    });
  });

  it('falls back to the full list when a desktop window no longer fits the stage', () => {
    enter();
    staged = false;
    act(() => mediaListeners.get(SKILLS_STAGE_QUERY)?.forEach(listener => listener({ matches: false })));
    expect(stage()).toHaveAttribute('data-staged', 'false');
    expect(screen.getAllByRole('article')).toHaveLength(SKILL_CHAPTERS.length);
    expect(getOverlayOcclusion()).toBe(false);
  });

  it('does not restart Skills when a static reader below the section resizes to desktop staging', () => {
    staged = false;
    top = -10000;
    mount();
    staged = true;
    act(() => mediaListeners.get(SKILLS_STAGE_QUERY)?.forEach(listener => listener({ matches: true })));
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(stage()).toHaveAttribute('aria-hidden', 'true');
    expect(getOverlayOcclusion()).toBe(false);
    place(-3300);
    wheel(-500);
    advance(1900);
    expect(index()).toBe(5);
  });

  it('preserves the underlay during transparent boundaries and covers it only behind the opaque stage', () => {
    mount();
    place(80);
    advance(200);
    const underlay = screen.getByTestId('underlay');
    expect(Number(stage().style.opacity)).toBeLessThan(1);
    expect(underlay.style.visibility).toBe('');
    advance(3100);
    expect(underlay.style.visibility).toBe('hidden');
    expect(underlay).toHaveAttribute('data-skills-covered');
    act(() => publishSectionNavigation('projects'));
    expect(stage()).toHaveAttribute('data-phase', 'leaving');
    expect(Number(stage().style.opacity)).toBe(1);
    expect(underlay.style.visibility).toBe('');
    expect(underlay).not.toHaveAttribute('data-skills-covered');
  });

  it('releases covered DOM in a hidden tab and restores coverage without restarting a settled chapter', () => {
    enter();
    const underlay = screen.getByTestId('underlay');
    const hidden = vi.spyOn(document, 'hidden', 'get');
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(underlay.style.visibility).toBe('');
    expect(getOverlayOcclusion()).toBe(false);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(underlay.style.visibility).toBe('hidden');
    expect(getOverlayOcclusion()).toBe(true);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(index()).toBe(0);
    expect(next()).toBeEnabled();
  });

  it('makes only the obscured page inert while retaining navigation and restores it on release', () => {
    enter();
    expect(screen.getByTestId('underlay')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Navigation utility' }).closest('[inert]')).toBeNull();
    expect(next().closest('[inert]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to About' }));
    advance(1900);
    expect(screen.getByTestId('underlay')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('underlay').style.visibility).toBe('');
    expect(screen.getByTestId('underlay')).not.toHaveAttribute('data-skills-covered');
  });

  it('cleans up in-flight animation, pending frames, subscriptions and ownership on unmount', () => {
    enter();
    fireEvent.click(next());
    cleanup();
    advance(10000);
    expect(document.querySelector('[data-testid="skills-stage"]')).toBeNull();
    expect(getOverlayOcclusion()).toBe(false);
    expect(gsap.globalTimeline.getChildren().filter(animation => animation.isActive())).toHaveLength(0);
    wheel(100);
    expect(frames.size).toBe(0);
  });
});
