import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animationClock } from '@/test/animationClock';
import { TVProjects } from './TVProjects';
import {
  getProjectsSurface, getProjectsView, publishSkillsProjectsHandoff,
  setProjectsView, setTVScreenReady,
} from '@/lib/projects/projectsScene';
import { PROJECTS_APPROACH_MS, PROJECTS_TURN_MS } from '@/lib/projects/tvScreen';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { getOverlayOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';

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
  top = 1200;
  reduced = hidden = false;
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
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
  clock = animationClock();
});
afterEach(() => {
  cleanup();
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  setTVScreenReady(false);
  setProjectsView(false, 0, 0);
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
      <section id="contact">Contact copy</section>
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

describe('the completed-beat TV chapter', () => {
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

  it('releases Contact only after its departure finishes and can return naturally', async () => {
    const { onNavigate } = mount();
    await navbar('projects');
    wheel(200);
    await clock.run(PROJECTS_APPROACH_MS - 10);
    expect(onNavigate).not.toHaveBeenCalled();
    await clock.run(10);
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('contact', { immediate: true });
    expect(phase()).toBe('outside');
    top = -1300;
    clock.wait(300);
    wheel(-200);
    expect(phase()).toBe('approaching');
    await clock.run(PROJECTS_APPROACH_MS);
    expect(phase()).toBe('reading');
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
