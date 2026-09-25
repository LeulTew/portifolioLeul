import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { animationClock } from '@/test/animationClock';
import { TVProjects } from './TVProjects';
import {
  getProjectsSurface, getProjectsView, publishSkillsProjectsHandoff,
  isProjectsReturnOwed, setProjectsView, setTVScreenReady,
} from '@/lib/projects/projectsScene';
import { PROJECTS_APPROACH_MS, PROJECTS_TURN_MS } from '@/lib/projects/tvScreen';
import { CONTACT_FLIGHT_MS } from '@/lib/camera/contactFlight';
import {
  commitContactPose, getContactView, registerContactCamera, releaseContactSky,
} from '@/lib/contact/contactScene';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { isScrollKeyClaimed } from '@/lib/scroll/keyboardScroll';
import { installStoryKeys } from '@/lib/scroll/storyKeys';
import { resetScrollGesture, SCROLL_WAVE_IDLE_MS } from '@/lib/scroll/scrollGesture';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { getOverlayOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';
import * as scrollContainer from '@/lib/scroll/scrollContainer';
import { CRT_POWER_ON_MS } from './projectBroadcast';
import { activateTV, getTVState, resetTVState, setTVExposure } from '@/lib/tv/tvState';

let top = 1200;
let reduced = false;
let hidden = false;
let clock: ReturnType<typeof animationClock>;
const rect = Element.prototype.getBoundingClientRect;

vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reduced,
  usePrefersReducedMotion: () => reduced,
}));

beforeEach(() => {
  resetTVState();
  top = 1200;
  reduced = hidden = false;
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  releaseContactSky();
  setProjectsView(false, 0, 0);
  setTVScreenReady(true);
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: !query.includes('reduced'), media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.id === 'projects' ? DOMRect.fromRect({ x: 0, y: top, width: 1440, height: 2340 }) : rect.call(this);
  });
  // playVisible seeks paused scores; its test clock must not include GSAP's global ticker.
  gsap.ticker.wake();
  gsap.ticker.sleep();
  vi.spyOn(gsap.ticker, 'wake').mockImplementation(() => {});
  clock = animationClock();
});
afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  setTVScreenReady(false);
  setProjectsView(false, 0, 0);
  releaseContactSky();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stage = () => screen.getByTestId('projects-stage');
const phase = () => stage().dataset.phase;
const mount = (onNavigate = vi.fn()) => {
  const tree = () => <>
    <button data-ink-control="projects">Projects navigation</button>
    <button data-ink-control="skills">Skills navigation</button>
    <button data-ink-control="contact">Contact navigation</button>
    <main data-testid="main">
      <section id="skills" data-staged="true" />
      <TVProjects onNavigate={onNavigate} />
      <section id="contact">
        Contact copy
        <input aria-label="Contact name" defaultValue="Draft name" />
        <textarea aria-label="Contact message" defaultValue="Unsent draft" />
      </section>
    </main>
  </>;
  const result = render(tree());
  return { ...result, onNavigate, refresh: () => result.rerender(tree()) };
};
const wheel = (deltaY = 100, target: EventTarget = window) => {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  act(() => { target.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(false);
};
const navbar = async (target: string) => {
  await act(async () => publishSectionNavigation(target, { source: 'navbar' }));
};
const handoff = () => {
  act(() => { publishSkillsProjectsHandoff('withdrawing'); });
  act(() => { publishSkillsProjectsHandoff('revealed'); });
};
const returnInput = (kind: 'held key' | 'wheel', repeat = true) => {
  if (kind === 'wheel') wheel(-200);
  else {
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', repeat, bubbles: true, cancelable: true });
    act(() => { window.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
  }
};

describe('the completed-beat TV chapter', () => {
  it('pages the current category with physical keys and powers off through the original retreat', async () => {
    mount();
    await navbar('projects');
    await clock.run(CRT_POWER_ON_MS);
    act(() => setTVExposure(true, 'all'));
    expect(phase()).toBe('reading');
    expect(stage()).toHaveRole('region');
    expect(stage()).toHaveAccessibleName('Project reader');
    const first = document.querySelector('[data-project-id]')?.getAttribute('data-project-id');
    expect(screen.queryByRole('button', { name: 'Next project' })).not.toBeInTheDocument();
    act(() => { expect(activateTV('next')).toBe(true); });
    expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).not.toBe(first);
    act(() => activateTV('previous'));
    expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(first);
    act(() => activateTV('power'));
    expect(phase()).toBe('retreating');
    expect(getTVState()).toMatchObject({ source: 'projects', broadcastOn: false });
    await clock.run(PROJECTS_APPROACH_MS);
    expect(phase()).toBe('framed');
    expect(getTVState().source).toBe('off');
    act(() => activateTV('power'));
    expect(getTVState().source).toBe('broadcast');
    fireEvent.click(screen.getByRole('button', { name: 'Open the screen' }));
    await clock.run(PROJECTS_APPROACH_MS);
    expect(getTVState()).toMatchObject({ source: 'projects', broadcastOn: true });
    expect(document.querySelector('[data-project-id]')?.getAttribute('data-project-id')).toBe(first);
  });

  it('does not claim a spent physical Projects position before Skills actually departs', async () => {
    mount();
    top = -4000;
    act(() => setScrollProgress(0.9));
    wheel();
    await clock.run(5000);
    expect(phase()).toBe('outside');
    expect(getProjectsView().active).toBe(false);
    expect(stage()).toHaveAttribute('aria-hidden', 'true');
  });

  it('combines actual plate withdrawal and turn without an empty-world input stop', async () => {
    mount();
    act(() => { publishSkillsProjectsHandoff('withdrawing'); });
    expect(phase()).toBe('withdrawing');
    expect(getProjectsView().turn).toBe(0);
    wheel(10000);
    await clock.run(800);
    expect(getProjectsView().turn).toBe(0);
    act(() => { publishSkillsProjectsHandoff('revealed'); });
    expect(phase()).toBe('turning');
    await clock.run(PROJECTS_TURN_MS - 10);
    expect(phase()).toBe('turning');
    expect(getProjectsView().turn).toBeLessThan(1);
    await clock.run(10);
    expect(phase()).toBe('framed');
    expect(getProjectsView().turn).toBe(1);
    expect(getProjectsView().approach).toBe(0);
    expect(clock.pending).toBe(0);
  });

  it.each([40, 20000])('keeps fixed turn/approach duration under a %ipx flick', async delta => {
    mount();
    handoff();
    for (let time = 0; time < PROJECTS_TURN_MS - 50; time += 50) {
      wheel(delta);
      await clock.frame(50);
    }
    expect(phase()).toBe('turning');
    wheel(delta);
    await clock.frame(50);
    expect(phase()).toBe('framed');
    expect(getProjectsView().approach).toBe(0);
    wheel(delta);
    expect(phase()).toBe('approaching');
    await clock.run(PROJECTS_APPROACH_MS - 10);
    expect(screen.getByRole('button', { name: 'Open the screen' })).toBeDisabled();
    wheel(delta);
    await clock.run(10);
    expect(phase()).toBe('reading');
    expect(screen.getByRole('button', { name: 'Next project' })).toBeEnabled();
    await clock.run(CRT_POWER_ON_MS);
    expect(clock.pending).toBe(0);
  });

  it.each(['held key', 'touch'])('accepts continuing %s input on the first event after turn completion', async kind => {
    mount();
    handoff();
    let y = 500;
    if (kind === 'touch') fireEvent.touchStart(window, { touches: [{ clientY: y }] });
    const input = () => {
      const event = kind === 'held key'
        ? new KeyboardEvent('keydown', { key: 'ArrowDown', repeat: true, bubbles: true, cancelable: true })
        : new TouchEvent('touchmove', { touches: [{ clientY: y -= 20 } as Touch], bubbles: true, cancelable: true });
      act(() => { window.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
    };
    input();
    await clock.run(PROJECTS_TURN_MS - 10);
    input();
    expect(phase()).toBe('turning');
    await clock.run(10);
    input();
    expect(phase()).toBe('approaching');
  });

  it('reverses approach, then the same turn, then lands at the trailing Skills record', async () => {
    const { onNavigate } = mount();
    await navbar('projects');
    wheel(-200);
    expect(phase()).toBe('retreating');
    wheel(-10000);
    await clock.run(PROJECTS_APPROACH_MS);
    expect(phase()).toBe('framed');
    expect(getProjectsView().turn).toBe(1);
    expect(getProjectsView().approach).toBe(0);
    wheel(-200);
    await clock.run(PROJECTS_TURN_MS);
    expect(phase()).toBe('revealed');
    expect(getProjectsView().turn).toBe(0);
    expect(onNavigate).not.toHaveBeenCalled();
    wheel(-200);
    expect(phase()).toBe('outside');
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('skills', { immediate: true, edge: 'end' });
    expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('main')).not.toHaveAttribute('data-projects-covered');
  });

  it('replaces the outbound retreat with one Contact flight and can return naturally', async () => {
    const { onNavigate } = mount();
    await navbar('projects');
    wheel(200);
    await clock.run(CONTACT_FLIGHT_MS - 10);
    expect(onNavigate).not.toHaveBeenCalled();
    await clock.run(10);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
    expect(phase()).toBe('outside');
    top = -1300;
    clock.wait(300);
    wheel(-200);
    expect(phase()).toBe('approaching');
    await clock.run(CONTACT_FLIGHT_MS);
    expect(phase()).toBe('reading');
  });

  it('keeps ownership until the final sky camera frame is committed, not just scheduled', async () => {
    const removeCamera = registerContactCamera();
    try {
      const { onNavigate } = mount();
      await navbar('projects');
      wheel(200);
      await clock.run(CONTACT_FLIGHT_MS);
      expect(getContactView()).toMatchObject({ mode: 'departing', progress: 1 });
      expect(phase()).toBe('departing');
      expect(screen.getByTestId('main')).toHaveAttribute('inert');
      expect(onNavigate).not.toHaveBeenCalled();
      await act(async () => commitContactPose(getContactView().revision, 1));
      expect(phase()).toBe('outside');
      expect(getContactView().mode).toBe('parked');
      expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
    } finally {
      removeCamera();
    }
  });

  it('cancels a pending camera receipt on navbar bypass without a late automatic landing', async () => {
    const removeCamera = registerContactCamera();
    try {
      const { onNavigate } = mount();
      await navbar('projects');
      wheel(200);
      await clock.run(CONTACT_FLIGHT_MS);
      const revision = getContactView().revision;
      await navbar('contact');
      await act(async () => commitContactPose(revision, 1));
      expect(phase()).toBe('outside');
      expect(getContactView().mode).toBe('parked');
      expect(onNavigate).not.toHaveBeenCalled();
      expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
    } finally {
      removeCamera();
    }
  });

  it('protects field input but permits an outside-page return with textarea focus retained', async () => {
    mount();
    await navbar('contact');
    top = -1300;
    const field = screen.getByRole('textbox', { name: 'Contact message' });
    fireEvent.change(field, { target: { value: 'Keep this unsent message' } });
    field.focus();
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      fireEvent(field, event);
      expect(event.defaultPrevented).toBe(false);
    }
    wheel(-20000, field);
    fireEvent.touchStart(field, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(field, { touches: [{ clientY: 500 }] });
    fireEvent.touchEnd(field);
    act(() => setScrollProgress(0.2));
    expect(phase()).toBe('outside');
    expect(field).toHaveFocus();
    expect(field).toHaveValue('Keep this unsent message');
    const blur = vi.spyOn(field, 'blur');
    wheel(-200);
    expect(phase()).toBe('approaching');
    expect(blur).not.toHaveBeenCalled();
    await clock.run(CONTACT_FLIGHT_MS);
    expect(phase()).toBe('reading');
    expect(field).toHaveValue('Keep this unsent message');
  });

  it('invalidates a pre-focus return wave without turning later typing or scroll publications into camera requests', async () => {
    mount();
    await navbar('contact');
    top = -4000;
    wheel(-200);
    const field = screen.getByRole('textbox', { name: 'Contact message' });
    field.focus();
    wheel(-200);
    expect(phase()).toBe('outside');
    top = -1300;
    fireEvent.keyDown(field, { key: 'ArrowUp', repeat: true });
    fireEvent.change(field, { target: { value: 'Still editing' } });
    act(() => setScrollProgress(0.2));
    expect(phase()).toBe('outside');
    expect(field).toHaveFocus();
    wheel(-200);
    expect(phase()).toBe('approaching');
    expect(field).toHaveValue('Still editing');
  });

  it.each(['held key', 'wheel'] as const)(
    'accepts continued %s return input after departure completion without queuing the early input', async kind => {
      const { onNavigate } = mount();
      await navbar('projects');
      top = -1300;
      wheel(200);
      returnInput(kind, false);
      for (let elapsed = 0; elapsed < CONTACT_FLIGHT_MS - 50; elapsed += 50) {
        await clock.frame(50);
        returnInput(kind);
        expect(phase()).toBe('departing');
      }
      await clock.frame(40);
      returnInput(kind);
      expect(phase()).toBe('departing');
      expect(onNavigate).not.toHaveBeenCalled();
      await clock.frame(10);
      expect(phase()).toBe('outside');
      expect(isProjectsReturnOwed()).toBe(true);
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
      expect(clock.pending).toBe(0);
      returnInput(kind);
      expect(phase()).toBe('approaching');
      expect(isProjectsReturnOwed()).toBe(false);
      expect(getProjectsView().entry).toBe('contact');
      await clock.run(CONTACT_FLIGHT_MS);
      expect(phase()).toBe('reading');
    },
  );

  it.each([
    ['held key', false], ['wheel', false], ['held key', true], ['wheel', true],
  ] as const)(
    'keeps navbar cancellation authoritative for %s input, afterRelease=%s', async (kind, afterRelease) => {
      mount();
      await navbar('projects');
      top = -1300;
      wheel(200);
      returnInput(kind, false);
      await clock.run(afterRelease ? CONTACT_FLIGHT_MS - 10 : 100);
      returnInput(kind);
      if (afterRelease) await clock.frame(10);
      await navbar('contact');
      for (let count = 0; count < 4; count++) {
        await clock.frame(50);
        returnInput(kind);
        expect(phase()).toBe('outside');
        expect(getProjectsView().active).toBe(false);
        expect(isProjectsReturnOwed()).toBe(true);
      }
      expect(screen.getByTestId('main')).not.toHaveAttribute('data-projects-covered');
      expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
      if (kind === 'wheel') clock.wait(SCROLL_WAVE_IDLE_MS);
      returnInput(kind, false);
      expect(phase()).toBe('approaching');
    },
  );

  it.each(['ArrowUp', 'PageUp'])(
    'moves real scroll-linked return geometry for accepted navbar-focused %s, without skipping the position gate', async key => {
      mount();
      await navbar('projects');
      const navigationTarget = screen.getByRole('button', { name: 'Projects navigation' });
      navigationTarget.focus();
      const scroller = document.createElement('div');
      Object.defineProperty(scroller, 'clientHeight', { value: 900 });
      scroller.scrollTop = 14808;
      vi.spyOn(scrollContainer, 'findScrollContainer').mockReturnValue(scroller);
      document.getElementById('projects')!.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 0, y: 12008 - scroller.scrollTop, width: 1440, height: 2340 });
      wheel(200);
      fireEvent.keyDown(navigationTarget, { key, repeat: false });
      await clock.run(CONTACT_FLIGHT_MS - 10);
      fireEvent.keyDown(navigationTarget, { key, repeat: true });
      expect(scroller.scrollTop).toBe(14808);
      await clock.frame(10);
      expect(phase()).toBe('outside');
      const count = key === 'ArrowUp' ? 32 : key === 'PageUp' ? 2 : 1;
      for (let index = 0; index < count; index++) {
        const event = new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true });
        fireEvent(navigationTarget, event);
        expect(event.defaultPrevented).toBe(false);
        act(() => setScrollProgress(0.8 - (index + 1) / 1000));
        if (index < count - 1) expect(phase()).toBe('outside');
      }
      expect(phase()).toBe('approaching');
      expect(isProjectsReturnOwed()).toBe(false);
      expect(navigationTarget).toHaveFocus();
    },
  );

  it('keeps the return keys at parked Contact, and leaves Home to the start of the story', async () => {
    mount();
    await navbar('contact');
    const press = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    expect(isScrollKeyClaimed(press('ArrowUp'))).toBe(true);
    expect(isScrollKeyClaimed(press('PageUp'))).toBe(true);
    expect(isScrollKeyClaimed(press('Home'))).toBe(false);
    expect(isScrollKeyClaimed(press('End'))).toBe(false);
  });

  it('lets Home and End travel the story from an engaged TV, releasing it on the way', async () => {
    // Round 9 (TECH-018): the engaged TV claimed every key, so neither the story nor the TV moved for them.
    mount();
    await navbar('projects');
    expect(phase()).toBe('reading');
    const travels: string[] = [];
    const release = installStoryKeys({
      navigate: (section, options) => { travels.push(section); publishSectionNavigation(section, options); },
    });
    try {
      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      expect(travels).toEqual([]);
      fireEvent.keyDown(document.body, { key: 'End' });
      expect(travels).toEqual(['contact']);
      expect(phase()).toBe('outside');
    } finally {
      release();
    }
  });

  it('does not forward a held return key after explicit navbar cancellation', async () => {
    mount();
    await navbar('projects');
    const scroller = document.createElement('div');
    scroller.scrollTop = 14808;
    vi.spyOn(scrollContainer, 'findScrollContainer').mockReturnValue(scroller);
    top = -2799;
    wheel(200);
    returnInput('held key', false);
    await clock.run(CONTACT_FLIGHT_MS);
    await navbar('contact');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Contact navigation' }), { key: 'ArrowUp', repeat: true });
    expect(scroller.scrollTop).toBe(14808);
    expect(phase()).toBe('outside');
  });

  it.each(['display', 'artwork', 'header', 'footer', 'link', 'control'] as const)(
    'routes screen browsing through its %s without moving or leaving the scene', async region => {
      mount();
      await navbar('projects');
      const scroller = document.createElement('div');
      vi.spyOn(scrollContainer, 'findScrollContainer').mockReturnValue(scroller);
      const display = screen.getByRole('tabpanel');
      const target = () => region === 'display' ? display
        : region === 'artwork' ? display.querySelector('img')!
          : region === 'header' ? display.querySelector('[data-projects-header]')!
            : region === 'footer' ? display.querySelector('[data-projects-footer]')!
              : region === 'link' ? screen.getByRole('link', { name: 'See project' })
                : screen.getByRole('button', { name: 'Next project' });
      for (const delta of [200, -200]) {
        wheel(delta, target());
        expect(phase()).toBe('reading');
        expect(document.querySelector('[data-project-id]')).toHaveAttribute(
          'data-project-id', delta > 0 ? '23' : '36',
        );
        expect(scroller.scrollTop).toBe(0);
      }
      const key = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
      fireEvent(target(), key);
      expect(key.defaultPrevented).toBe(false);
      fireEvent.touchStart(target(), { touches: [{ clientY: 500 }] });
      expect(fireEvent.touchMove(target(), { touches: [{ clientY: 300 }], cancelable: true })).toBe(true);
      fireEvent.touchEnd(target());
      expect(phase()).toBe('reading');
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '36');
      expect(scroller.scrollTop).toBe(0);
      fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '23');
      fireEvent.click(screen.getByRole('button', { name: /^Contact$/ }));
      expect(phase()).toBe('departing');
    },
  );

  it('accepts consecutive screen wheel selections while the broadcast and CRT boot are still moving', async () => {
    mount();
    await navbar('projects');
    const display = screen.getByRole('tabpanel');
    wheel(100, display);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '23');
    wheel(100, display);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '25');
    wheel(100, display);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '28');
    expect(screen.getByRole('button', { name: 'Next project' })).toBeEnabled();
    expect(screen.getByRole('tab', { name: 'Mobile Apps' })).toBeEnabled();
    expect(phase()).toBe('reading');
    fireEvent.click(screen.getByRole('tab', { name: 'Mobile Apps' }));
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', '36');
  });

  it('preserves native scrolling and control keys inside the reader without changing chapters', async () => {
    mount();
    await navbar('projects');
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    const details = screen.getByLabelText('Mizan details');
    const initial = document.querySelector('[data-project-id]')!.getAttribute('data-project-id');
    for (const key of ['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      fireEvent(details, event);
      expect(event.defaultPrevented).toBe(false);
      expect(phase()).toBe('reading');
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', initial);
    }
    wheel(10000, details);
    wheel(-10000, details);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next project' }), { key: 'ArrowRight' });
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', initial);
    expect(phase()).toBe('reading');
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('hands control-initiated approach focus to the reader and restores reverse control focus', async () => {
    mount();
    handoff();
    await clock.run(PROJECTS_TURN_MS);
    const open = screen.getByRole('button', { name: 'Open the screen' });
    open.focus();
    fireEvent.click(open);
    await clock.run(PROJECTS_APPROACH_MS);
    expect(screen.getByRole('tabpanel')).toHaveFocus();
    const back = screen.getByRole('button', { name: 'Back to the scene' });
    back.focus();
    fireEvent.click(back);
    await clock.run(PROJECTS_APPROACH_MS);
    expect(screen.getByRole('button', { name: 'Back to the scene' })).toHaveFocus();
  });

  it('keeps the full scene-back name when a tight frame shows only its short label', async () => {
    mount();
    handoff();
    await clock.run(PROJECTS_TURN_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Open the screen' }));
    await clock.run(PROJECTS_APPROACH_MS);
    const back = screen.getByRole('button', { name: 'Back to the scene' });
    expect(back).toHaveTextContent('Back to the scene');
    const short = [...back.querySelectorAll('[aria-hidden="true"]')].find(node => node.textContent === 'Back');
    expect(short).toBeDefined();
  });

  it.each(['withdrawing', 'turning', 'approaching', 'reading', 'retreating'])(
    'repeated navbar navigation cancels %s and opens the chosen useful destination', async starting => {
      mount();
      if (starting === 'withdrawing') act(() => { publishSkillsProjectsHandoff('withdrawing'); });
      else if (starting === 'turning' || starting === 'approaching') {
        handoff();
        if (starting === 'approaching') {
          await clock.run(PROJECTS_TURN_MS);
          wheel();
        }
      } else {
        await navbar('projects');
        if (starting === 'retreating') wheel(-200);
      }
      expect(phase()).toBe(starting);
      await navbar('contact');
      await clock.run(5000);
      expect(phase()).toBe('outside');
      expect(getProjectsView().active).toBe(false);
      expect(getOverlayOcclusion()).toBe(false);
      expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
      expect(screen.getByTestId('main').style.visibility).toBe('');
      await navbar('projects');
      expect(phase()).toBe('reading');
      expect(getProjectsView()).toMatchObject({ active: true, turn: 1, approach: 1 });
      await navbar('projects');
      expect(phase()).toBe('reading');
      expect(screen.getByRole('button', { name: 'Next project' })).toBeEnabled();
      await clock.run(CRT_POWER_ON_MS);
      expect(clock.pending).toBe(0);
    },
  );

  it('does not interpret an automatic immediate Projects landing as navbar bypass', async () => {
    mount();
    handoff();
    await act(async () => publishSectionNavigation('projects', { immediate: true }));
    expect(phase()).toBe('turning');
    await clock.run(PROJECTS_TURN_MS);
    expect(phase()).toBe('framed');
    expect(getProjectsView().approach).toBe(0);
  });

  it('pauses in a hidden tab and caps a suspended frame at 50ms of visible time', async () => {
    mount();
    handoff();
    await clock.run(500);
    const before = getProjectsView().turn;
    hidden = true;
    fireEvent(document, new Event('visibilitychange'));
    await clock.run(2000);
    expect(getProjectsView().turn).toBe(before);
    expect(clock.pending).toBe(0);
    hidden = false;
    fireEvent(document, new Event('visibilitychange'));
    await clock.frame(30000);
    expect(getProjectsView().turn - before).toBeCloseTo(50 / PROJECTS_TURN_MS);
    await clock.run(PROJECTS_TURN_MS);
    expect(phase()).toBe('framed');
  });

  it('pauses the sky flight and its ownership receipt while hidden without adding a resume cooldown', async () => {
    const { onNavigate } = mount();
    await navbar('projects');
    wheel(200);
    await clock.run(500);
    const before = getContactView().progress;
    hidden = true;
    fireEvent(document, new Event('visibilitychange'));
    await clock.run(10000);
    expect(getContactView().progress).toBe(before);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(clock.pending).toBe(0);
    hidden = false;
    fireEvent(document, new Event('visibilitychange'));
    await clock.frame(30000);
    expect(getContactView().progress - before).toBeCloseTo(50 / CONTACT_FLIGHT_MS);
    await clock.run(CONTACT_FLIGHT_MS - 550);
    expect(phase()).toBe('outside');
    expect(getContactView().mode).toBe('parked');
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
  });

  it('settles reduced motion toward the requested Contact destination rather than back onto the TV', async () => {
    const { refresh, onNavigate } = mount();
    await navbar('projects');
    wheel(200);
    await clock.run(500);
    reduced = true;
    refresh();
    expect(phase()).toBe('outside');
    expect(getContactView().mode).toBe('parked');
    expect(stage()).not.toHaveAttribute('data-contact-flight');
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
  });

  it('settles a live reduced-motion preference without leaving stale animation or ownership', async () => {
    const { refresh } = mount();
    handoff();
    await clock.run(300);
    reduced = true;
    refresh();
    expect(phase()).toBe('reading');
    expect(clock.pending).toBe(0);
    wheel(200);
    expect(phase()).toBe('outside');
  });

  it('cleans its own frames, cover, inert state and projection registration on unmount', async () => {
    const { unmount } = mount();
    handoff();
    expect(getProjectsSurface()).not.toBeNull();
    expect(screen.getByTestId('main')).toHaveAttribute('data-projects-covered');
    expect(getOverlayOcclusion()).toBe(false);
    unmount();
    expect(getProjectsSurface()).toBeNull();
    expect(getProjectsView().active).toBe(false);
    expect(clock.pending).toBe(0);
    await act(async () => publishSectionNavigation('projects', { source: 'navbar' }));
    expect(getProjectsView().active).toBe(false);
  });
});
