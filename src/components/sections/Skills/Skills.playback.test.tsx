// @vitest-environment happy-dom
// Keep real DOM/GSAP playback without jsdom's costly per-glyph style cascade.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { Skills } from './Skills';
import { SKILL_CHAPTERS, SKILLS_REVEAL_SECONDS, SKILLS_STAGE_QUERY, SKILLS_TRANSITION_SECONDS, skillChapterId } from './skillsData';
import { getMaterialGeometry } from './skillGeometry';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { publishSectionNavigation, type SectionNavigationOptions } from '@/lib/scroll/sectionNavigation';
import { getOverlayOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';

let top = 1200;
let publication = 0;
let frameId = 0;
let now = 0;
let staged = true;
let reduced = false;
const frames = new Map<number, FrameRequestCallback>();
const mediaListeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
const originalRect = Element.prototype.getBoundingClientRect;
const originalConsolidate = Object.getOwnPropertyDescriptor(SVGTransformList.prototype, 'consolidate');

const stage = () => screen.getByTestId('skills-stage');
const index = () => Number(stage().dataset.activeSkill);
const next = () => screen.getByRole('button', { name: /^Next:/ });
const entranceMs = Math.round((SKILLS_REVEAL_SECONDS + 0.16) * 1000);
const crossingMs = SKILLS_TRANSITION_SECONDS * 1000;
// The imported gateway also owns ScrollTrigger frames; Skills must stop only its own clock.
const playbackFrames = () => [...frames.values()].filter(callback => callback.name === 'tick');

// Behavioral cases exercise the 50ms visible-frame ceiling; pacing cases use 16ms.
function advance(ms: number, interval = 50) {
  let remaining = ms;
  while (remaining > 0) {
    if (frames.size === 0) {
      now += remaining;
      return;
    }
    const delta = Math.min(interval, remaining);
    act(() => {
      now += delta;
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(performance.now()));
    });
    remaining -= delta;
  }
}

function place(value: number) {
  top = value;
  act(() => setScrollProgress(++publication / 100));
}

function wheel(deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
}

async function navbar(target: string) {
  await act(async () => { publishSectionNavigation(target, { source: 'navbar' }); });
}

async function mutateObservedDom(mutate: () => void) {
  await act(async () => {
    mutate();
    // Happy DOM delivers its real MutationObserver records on the next task.
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  });
}

function mount(onNavigate?: (section: string) => void) {
  render(<>
    <button type="button">Navigation utility</button>
    <main data-testid="underlay">
      <button type="button">Background action</button>
      <Skills onNavigate={onNavigate} />
    </main>
  </>);
}

function enter(onNavigate?: (section: string) => void) {
  mount(onNavigate);
  place(80);
  advance(entranceMs);
  expect(next()).toBeEnabled();
}

function cross() {
  fireEvent.click(next());
  advance(crossingMs);
}

beforeEach(() => {
  top = 1200;
  publication = 0;
  frameId = 0;
  now = 0;
  staged = true;
  reduced = false;
  frames.clear();
  mediaListeners.clear();
  resetScrollProgress();
  resetScrollGesture();
  resetCameraHold();
  // Happy DOM exposes SVG transform lists but does not yet consolidate them.
  // Compose their actual matrices instead of replacing GSAP's SVG transforms.
  if (!originalConsolidate) Object.defineProperty(SVGTransformList.prototype, 'consolidate', {
    configurable: true,
    value: function (this: SVGTransformList) {
      if (this.numberOfItems === 0) return null;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      let matrix = svg.createSVGMatrix();
      for (let index = 0; index < this.numberOfItems; index++) {
        matrix = matrix.multiply(this.getItem(index).matrix);
      }
      return this.initialize(svg.createSVGTransformFromMatrix(matrix));
    },
  });
  // Skills seeks paused GSAP scores from its own visible-time rAF callback.
  // Stop the native ticker before replacing the clock; seeking must not wake it.
  gsap.ticker.wake();
  gsap.ticker.sleep();
  vi.spyOn(gsap.ticker, 'wake').mockImplementation(() => {});
  // Playback needs only performance/rAF control; keep observer delivery native.
  vi.spyOn(performance, 'now').mockImplementation(() => now);
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalConsolidate) Object.defineProperty(SVGTransformList.prototype, 'consolidate', originalConsolidate);
  else Reflect.deleteProperty(SVGTransformList.prototype, 'consolidate');
});

describe('Skills SVG playback fixture', () => {
  it('composes actual non-identity matrices in authored order and retains the resulting transform', () => {
    const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    graphic.setAttribute('transform', 'translate(12 8) scale(2 3)');
    const list = graphic.transform.baseVal;
    const result = list.consolidate();
    expect(result?.matrix).toMatchObject({ a: 2, b: 0, c: 0, d: 3, e: 12, f: 8 });
    expect(list.numberOfItems).toBe(1);
    expect(list.getItem(0)).toBe(result);
    expect(list.consolidate()?.matrix).toMatchObject({ a: 2, b: 0, c: 0, d: 3, e: 12, f: 8 });
  });

  it('does not invent a transform for an empty list', () => {
    const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    expect(graphic.transform.baseVal.consolidate()).toBeNull();
    expect(graphic.transform.baseVal.numberOfItems).toBe(0);
  });
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

  it.each([40, 20000])('keeps the full entry duration with no extra pause for a %ipx scroll', delta => {
    mount();
    place(80);
    wheel(delta);
    advance(entranceMs - 10, 16);
    expect(stage()).toHaveAttribute('data-phase', 'entering');
    expect(next()).toBeDisabled();
    advance(10, 16);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(next()).toBeEnabled();
    expect(playbackFrames()).toHaveLength(0);
  });

  it('does not spend scroll distance when using its controls', () => {
    enter();
    fireEvent.click(next());
    expect(index()).toBe(1);
    expect(next()).toBeDisabled();
    expect(window.scrollBy).not.toHaveBeenCalled();
    advance(crossingMs - 10);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    expect(next()).toBeDisabled();
    advance(10);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    expect(index()).toBe(2);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('accepts a continuing wheel stream on completion without requiring a quiet interval', () => {
    enter();
    wheel(500);
    expect(index()).toBe(1);
    for (let count = 0; count < crossingMs / 50 - 1; count++) {
      advance(50);
      wheel(500);
      expect(index()).toBe(1);
    }
    expect(next()).toBeDisabled();
    advance(50);
    expect(index()).toBe(1);
    expect(next()).toBeEnabled();
    wheel(500);
    expect(index()).toBe(2);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    advance(crossingMs - 50);
    wheel(-500);
    expect(index()).toBe(2);
    advance(50);
    wheel(-500);
    expect(index()).toBe(1);
  });

  it.each(['touch', 'held key'])('accepts continued %s input after completion without changing movement duration', kind => {
    enter();
    let y = 500;
    if (kind === 'touch') fireEvent.touchStart(window, { touches: [{ clientY: y }] });
    const gesture = () => {
      if (kind === 'touch') {
        y -= 10;
        expect(fireEvent.touchMove(window, { touches: [{ clientY: y }], cancelable: true })).toBe(true);
      } else {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true, bubbles: true, cancelable: true });
        act(() => window.dispatchEvent(event));
        expect(event.defaultPrevented).toBe(false);
      }
      gsap.ticker.sleep();
    };
    gesture();
    expect(index()).toBe(1);
    advance(crossingMs - 50);
    gesture();
    expect(index()).toBe(1);
    advance(50);
    expect(next()).toBeEnabled();
    gesture();
    expect(index()).toBe(2);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
  });

  it('accepts scroll on the exact completion frame in either direction', () => {
    enter();
    wheel(500);
    advance(crossingMs);
    expect(index()).toBe(1);
    expect(next()).toBeEnabled();
    wheel(-500);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    advance(crossingMs);
    expect(index()).toBe(0);
    expect(next()).toBeEnabled();
    wheel(500);
    expect(index()).toBe(1);
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
    expect(progress.querySelector('[aria-current="step"]')).toHaveAttribute('aria-label', 'Show Languages');
    advance(1800);
    expect(progress.querySelector('[aria-current="step"]')).toHaveAttribute('aria-label', 'Show Frameworks & Web');
  });

  it('retains six labeled progress lines without a duplicate visual fraction', () => {
    enter();
    const progress = screen.getByRole('list', { name: 'Skills chapters' });
    expect(progress.children).toHaveLength(6);
    expect(screen.queryByText('/ 06')).not.toBeInTheDocument();
    expect(screen.queryByText('01')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 6: Languages');
  });

  it('lets the progress lines jump directly to a skill and back without spending scroll distance', () => {
    enter();
    const sculpture = stage().querySelector('[data-skill-sculpture]');
    const jump = screen.getByRole('button', { name: 'Show Professional Skills' });
    fireEvent.click(jump);
    expect(index()).toBe(5);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(jump).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: 'See projects' })).toBeEnabled();
    expect(stage().querySelector('[data-skill-sculpture]')).toBe(sculpture);
    expect(window.scrollBy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show AI & Data Science' }));
    expect(index()).toBe(2);
    expect(screen.getByRole('heading', { name: 'AI & Data Science' })).toBeVisible();
    expect(next()).toBeEnabled();
  });

  it('an explicit progress selection can replace an unfinished movement without a stale completion', () => {
    enter();
    fireEvent.click(next());
    advance(200);
    const choose = screen.getByRole('button', { name: 'Show Tools & Design' });
    expect(choose).toBeEnabled();
    fireEvent.click(choose);
    expect(index()).toBe(4);
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    advance(crossingMs);
    expect(index()).toBe(4);
    expect(playbackFrames()).toHaveLength(0);
    wheel(-500);
    expect(index()).toBe(3);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
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

  it('hands the reader to Projects however far the document ran on beneath the last chapter', () => {
    // Round 9 (D-FLAT-003): the flat page's native scroll carried on under the hold, and a
    // release that only aligned "still on the rail" left the reader at Contact, Projects skipped.
    const navigate = vi.fn();
    enter(navigate);
    for (let count = 1; count < SKILL_CHAPTERS.length; count++) cross();
    place(-20000);
    wheel(500);
    advance(650);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('projects');
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

  it('honors a chapter navigation intent immediately after the current movement completes', () => {
    const navigate = vi.fn();
    enter(navigate);
    fireEvent.click(next());
    act(() => publishSectionNavigation('contact'));
    advance(crossingMs - 10);
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
    advance(10);
    expect(stage()).toHaveAttribute('data-phase', 'leaving');
    advance(600);
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(navigate).not.toHaveBeenCalled();
    place(-20000);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
  });

  it.each(['home', 'about', 'projects', 'contact'])('navbar %s bypasses an unfinished crossing and releases every owner', async target => {
    enter();
    fireEvent.click(next());
    advance(200);
    await navbar(target);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(document.getElementById('skills')).not.toHaveAttribute('data-skills-active');
    expect(screen.getByTestId('underlay')).not.toHaveAttribute('inert');
    expect(document.querySelector('[data-skills-covered]')).toBeNull();
    expect(getOverlayOcclusion()).toBe(false);
    expect(playbackFrames()).toHaveLength(0);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
  });

  it.each(['entering', 'reading', 'leaving'])('navbar navigation does not wait for the %s phase', async phase => {
    mount();
    place(80);
    if (phase !== 'entering') advance(entranceMs);
    if (phase === 'leaving') fireEvent.click(screen.getByRole('button', { name: 'Back to About' }));
    expect(stage()).toHaveAttribute('data-phase', phase);
    await navbar('contact');
    expect(stage()).not.toHaveAttribute('data-visible');
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(playbackFrames()).toHaveLength(0);
  });

  it('navbar Skills opens its first settled pose without replaying earlier or interrupted chapters', async () => {
    enter();
    const sculpture = stage().querySelector('[data-skill-sculpture]');
    fireEvent.click(next());
    advance(200);
    await navbar('skills');
    expect(stage()).toHaveAttribute('data-phase', 'reading');
    expect(stage()).toHaveAttribute('data-visible', 'true');
    expect(index()).toBe(0);
    expect(next()).toBeEnabled();
    expect(stage().querySelector('[data-skill-sculpture]')).toBe(sculpture);
    expect(playbackFrames()).toHaveLength(0);
    wheel(500);
    expect(index()).toBe(1);
    advance(100);
    expect(stage()).toHaveAttribute('data-phase', 'crossing');
  });

  it('a newer navbar destination cannot be reclaimed by a deferred Skills claim', async () => {
    mount();
    await act(async () => {
      publishSectionNavigation('skills', { source: 'navbar' });
      publishSectionNavigation('contact', { source: 'navbar' });
    });
    place(-10000);
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    expect(stage()).not.toHaveAttribute('data-visible');
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
    await mutateObservedDom(() => { about.removeAttribute('data-education-active'); });
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
    await mutateObservedDom(() => { about.dataset.titleSettled = 'true'; });
    advance(5000);
    expect(stage()).toHaveAttribute('data-phase', 'outside');
    await mutateObservedDom(() => { about.dataset.educationReleased = 'true'; });
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
    await mutateObservedDom(() => { about.dataset.titleSettled = 'true'; });
    expect(stage()).not.toHaveAttribute('data-visible');
    await mutateObservedDom(() => { overlay.dataset.active = 'false'; });
    advance(3100);
    expect(next()).toBeEnabled();
    overlay.remove();
    about.remove();
  });

  it('resumes the unseen movement after a hidden tab and enables input on its final frame', () => {
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
    advance(entranceMs - 410);
    expect(next()).toBeDisabled();
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(10000);
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    advance(10);
    expect(next()).toBeEnabled();
    expect(playbackFrames()).toHaveLength(0);
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

  describe('a reader carried across a change of motion preference', () => {
    // Round 14 (D-MOTION-001): the staged reader came back empty for 12s and more, focus on the page.
    const motion = (value: boolean) => {
      reduced = value;
      act(() => mediaListeners.get('(prefers-reduced-motion: reduce)')?.forEach(listener => listener({ matches: value })));
    };
    const navigate = () => vi.fn((section: string, options?: SectionNavigationOptions) => publishSectionNavigation(section, options));

    it('opens the linear page on the chapter being read, and the staged reader on it again', async () => {
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      cross();
      expect(index()).toBe(2);
      motion(true);
      expect(stage()).toHaveAttribute('data-staged', 'false');
      advance(100);
      expect(onNavigate).toHaveBeenLastCalledWith('skills', { source: 'navbar', resume: true, anchor: skillChapterId(2) });
      // Focus lost with the staged reader lands on the chapter's own title.
      const title = document.querySelector<HTMLElement>(`#${skillChapterId(2)} [data-skill-landing]`);
      expect(document.activeElement).toBe(title);
      // And again after a track rebuild detached it, when the rebuilt track takes the navigation again.
      act(() => {
        title!.blur();
        publishSectionNavigation('skills', { source: 'navbar', resume: true, anchor: skillChapterId(2) });
      });
      expect(document.activeElement).toBe(title);

      // Round 16 (TECH-055): the rebuild's own settling scrolls do not replace the chapter resumed.
      act(() => { window.dispatchEvent(new Event('scroll')); });
      advance(20);

      motion(false);
      advance(100);
      await act(async () => {});
      advance(50);
      expect(onNavigate).toHaveBeenLastCalledWith('skills', { source: 'navbar', resume: true });
      expect(stage()).toHaveAttribute('data-staged', 'true');
      expect(stage()).toHaveAttribute('data-phase', 'reading');
      expect(stage()).not.toHaveAttribute('aria-hidden');
      expect(index()).toBe(2);
      expect(screen.getByRole('heading', { name: SKILL_CHAPTERS[2].title })).toBeInTheDocument();
      expect(document.activeElement).toBe(document.getElementById('skills-heading'));
    });

    it('gives way to the reader moving on first', () => {
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      motion(true);
      wheel(120);
      advance(100);
      expect(onNavigate).not.toHaveBeenCalledWith('skills', expect.anything());
    });

    const resumes = (onNavigate: ReturnType<typeof navigate>) =>
      onNavigate.mock.calls.filter(([, options]) => options?.resume).length;

    it('gives way to a newer destination chosen before it lands, however it was chosen', () => {
      // Round 15 (TECH-050): a Contact activation with no pointer or key event was overruled by the resume.
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      motion(true);
      act(() => publishSectionNavigation('contact', { source: 'navbar' }));
      advance(100);
      expect(resumes(onNavigate)).toBe(0);
    });

    it('forgets the chapter once the reader has been taken elsewhere', async () => {
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      cross();
      motion(true);
      advance(100);
      expect(resumes(onNavigate)).toBe(1);
      act(() => publishSectionNavigation('contact', { source: 'navbar' }));
      motion(false);
      advance(100);
      await act(async () => {});
      expect(resumes(onNavigate)).toBe(1);
      expect(index()).toBe(0);
    });

    /** The linear page's chapters, 700px apart below the section's top. */
    const layoutChapters = () => vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      if (this.id === 'skills') return DOMRect.fromRect({ x: 0, y: top, width: 1440, height: 4320 });
      const chapter = this instanceof HTMLElement ? this.dataset.skillChapter : undefined;
      if (chapter !== undefined) return DOMRect.fromRect({ x: 0, y: top + 200 + Number(chapter) * 700, width: 1440, height: 700 });
      return originalRect.call(this);
    });

    it.each([
      ['a new choice of Skills in the linear page', () => publishSectionNavigation('skills', { source: 'navbar' })],
      ['a click before the resume lands', () => window.dispatchEvent(new Event('pointerdown'))],
    ])('remembers where the reader is after %s, not the chapter they left', async (_case, takeOver) => {
      // Round 16: either one retired the placement but kept chapter 2 for the next remount.
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      cross();
      layoutChapters();
      motion(true);
      act(() => { takeOver(); });
      advance(100);
      motion(false);
      advance(100);
      await act(async () => {});
      expect(index()).toBe(0);
    });

    it('lets a new choice of Skills itself start afresh', async () => {
      const onNavigate = navigate();
      enter(onNavigate);
      cross();
      cross();
      motion(true);
      advance(100);
      motion(false);
      await navbar('skills');
      advance(100);
      await act(async () => {});
      expect(resumes(onNavigate)).toBe(1);
      expect(stage()).toHaveAttribute('data-phase', 'reading');
      expect(index()).toBe(0);
    });

    it('stages the chapter the reader scrolled to in the linear page', async () => {
      vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
        if (this.id === 'skills') return DOMRect.fromRect({ x: 0, y: top, width: 1440, height: 4320 });
        const chapter = this instanceof HTMLElement ? this.dataset.skillChapter : undefined;
        if (chapter !== undefined) return DOMRect.fromRect({ x: 0, y: top + 200 + Number(chapter) * 700, width: 1440, height: 700 });
        return originalRect.call(this);
      });
      staged = false;
      const onNavigate = navigate();
      mount(onNavigate);
      // Round 15 (TECH-053): a scrollbar drag outlasts any window after a discrete input.
      now += 5000;
      top = -2000;
      act(() => { window.dispatchEvent(new Event('scroll')); });
      advance(20);
      staged = true;
      act(() => mediaListeners.get(SKILLS_STAGE_QUERY)?.forEach(listener => listener({ matches: true })));
      advance(100);
      await act(async () => {});
      expect(stage()).toHaveAttribute('data-phase', 'reading');
      expect(index()).toBe(3);
    });
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

describe('Skills per-frame cost', () => {
  it('follows the scroll layer without reading layout on every publication, and still claims', () => {
    const layer = document.createElement('div');
    layer.style.transform = 'translate3d(0px, 0px, 0px)';
    document.body.append(layer);
    render(<main data-testid="underlay"><Skills /></main>, { container: layer });
    const rail = document.getElementById('skills')!;
    const railReads = () => vi.mocked(Element.prototype.getBoundingClientRect).mock.contexts
      .filter(context => context === rail).length;
    place(1200);
    const before = railReads();
    for (let step = 1; step <= 30; step++) {
      layer.style.transform = `translate3d(0px, ${-step * 30}px, 0px)`;
      place(1200 - step * 30);
    }
    expect(railReads() - before).toBe(0);
    layer.style.transform = 'translate3d(0px, -1120px, 0px)';
    place(80);
    advance(entranceMs);
    expect(next()).toBeEnabled();
  });
});
