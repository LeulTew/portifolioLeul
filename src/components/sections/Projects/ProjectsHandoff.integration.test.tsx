import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gsap from 'gsap';
import { Skills } from '../Skills/Skills';
import { SKILL_CHAPTERS } from '../Skills/skillsData';
import { TVProjects } from './TVProjects';
import { getProjectsView, isProjectsReturnOwed, setProjectsView, setTVScreenReady } from '@/lib/projects/projectsScene';
import { PROJECTS_APPROACH_MS, PROJECTS_TURN_MS } from '@/lib/projects/tvScreen';
import { getOverlayOcclusion, resetCameraHold } from '@/lib/camera/cameraHold';
import { publishSectionNavigation, type SectionNavigationOptions } from '@/lib/scroll/sectionNavigation';
import { resetScrollProgress, setScrollProgress } from '@/lib/scroll/scrollProgress';
import { resetScrollGesture } from '@/lib/scroll/scrollGesture';
import { animationClock } from '@/test/animationClock';

let skillsTop = 1200;
let projectsTop = 6200;
let publication = 0;
let reduced = false;
let fits = true;
const mediaListeners = new Map<string, Set<(event: { matches: boolean }) => void>>();
let clock: ReturnType<typeof animationClock>;
const rect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  skillsTop = 1200;
  projectsTop = 6200;
  publication = 0;
  reduced = false;
  fits = true;
  mediaListeners.clear();
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  setProjectsView(false, 0, 0);
  setTVScreenReady(true);
  vi.stubGlobal('innerWidth', 1440);
  vi.stubGlobal('innerHeight', 900);
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    get matches() { return query.includes('reduced') ? reduced : query.includes('min-width') && fits; },
    media: query,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
      if (!mediaListeners.has(query)) mediaListeners.set(query, new Set());
      mediaListeners.get(query)!.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
      mediaListeners.get(query)?.delete(listener),
    addListener: vi.fn(), removeListener: vi.fn(),
  })));
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.id === 'skills') return DOMRect.fromRect({ x: 0, y: skillsTop, width: 1440, height: 4320 });
    if (this.id === 'projects') return DOMRect.fromRect({ x: 0, y: projectsTop, width: 1440, height: 2340 });
    return rect.call(this);
  });
  clock = animationClock();
});
afterEach(() => {
  cleanup();
  gsap.ticker.sleep();
  setProjectsView(false, 0, 0);
  setTVScreenReady(false);
  resetScrollGesture();
  resetScrollProgress();
  resetCameraHold();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const advance = async (ms: number) => {
  gsap.ticker.sleep();
  await clock.run(ms);
  gsap.ticker.sleep();
};
const mount = async () => {
  const navigate = vi.fn((target: string, options?: SectionNavigationOptions) => {
    publishSectionNavigation(target, options);
    if (target === 'projects') {
      skillsTop = -4300;
      projectsTop = 80;
    } else if (target === 'skills') {
      skillsTop = 900 - 4320 - 80;
      projectsTop = 1300;
    }
    setScrollProgress(++publication / 100);
  });
  render(<>
    <button data-ink-control="skills">Skills navigation</button>
    <button data-ink-control="projects">Projects navigation</button>
    <button data-ink-control="contact">Contact navigation</button>
    <main data-testid="main">
      <Skills onNavigate={navigate} />
      <TVProjects onNavigate={navigate} />
      <section id="contact">Contact</section>
    </main>
  </>);
  gsap.ticker.sleep();
  skillsTop = 80;
  act(() => setScrollProgress(++publication / 100));
  await advance(1810);
  fireEvent.click(screen.getByRole('button', { name: `Show ${SKILL_CHAPTERS[SKILL_CHAPTERS.length - 1].title}` }));
  return navigate;
};
const projectPhase = () => screen.getByTestId('projects-stage').dataset.phase;
const skillPhase = () => screen.getByTestId('skills-stage').dataset.phase;

describe('the actual Skills / Projects ownership seam', () => {
  it('withdraws the real Skills plate before automatically playing a visible turn', async () => {
    const navigate = await mount();
    expect(getOverlayOcclusion()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'See projects' }));
    expect(projectPhase()).toBe('withdrawing');
    expect(skillPhase()).toBe('leaving');
    expect(getOverlayOcclusion()).toBe(false);
    expect(screen.getByTestId('main')).toHaveAttribute('data-projects-covered');
    expect(screen.getByTestId('main')).not.toHaveAttribute('data-skills-covered');
    await advance(590);
    expect(projectPhase()).toBe('withdrawing');
    expect(getProjectsView().turn).toBe(0);
    await advance(10);
    expect(skillPhase()).toBe('outside');
    expect(projectPhase()).toBe('turning');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('projects', { immediate: true });
    expect(screen.getByTestId('main')).toHaveAttribute('inert');
    await advance(PROJECTS_TURN_MS);
    expect(projectPhase()).toBe('framed');
    expect(getProjectsView().turn).toBe(1);
    expect(getProjectsView().approach).toBe(0);
  });

  it('retraces the camera and keeps it held until the returning last Skills plate is opaque', async () => {
    const navigate = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'See projects' }));
    await advance(600 + PROJECTS_TURN_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Open the screen' }));
    await advance(PROJECTS_APPROACH_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the scene' }));
    await advance(PROJECTS_APPROACH_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Back to the scene' }));
    await advance(PROJECTS_TURN_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Skills' }));
    expect(navigate).toHaveBeenLastCalledWith('skills', { immediate: true, edge: 'end' });
    expect(projectPhase()).toBe('outside');
    expect(skillPhase()).toBe('entering');
    expect(getProjectsView()).toMatchObject({ active: true, turn: 0, approach: 0 });
    await advance(590);
    expect(getProjectsView().active).toBe(true);
    await advance(10);
    expect(skillPhase()).toBe('reading');
    expect(screen.getByTestId('skills-stage')).toHaveAttribute('data-active-skill', '5');
    expect(getProjectsView().active).toBe(false);
    expect(getOverlayOcclusion()).toBe(true);
    expect(screen.getByTestId('main')).not.toHaveAttribute('data-projects-covered');
    expect(screen.getByTestId('main')).toHaveAttribute('data-skills-covered');
  });

  it('cancels an unfinished handoff for repeated navbar destinations without a late landing', async () => {
    const navigate = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'See projects' }));
    await advance(200);
    await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
    expect(skillPhase()).toBe('outside');
    expect(projectPhase()).toBe('outside');
    expect(screen.getByTestId('main')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('main').style.visibility).toBe('');
    await act(async () => publishSectionNavigation('projects', { source: 'navbar' }));
    await advance(8000);
    expect(projectPhase()).toBe('reading');
    expect(skillPhase()).toBe('outside');
    expect(navigate).not.toHaveBeenCalled();
    expect(getOverlayOcclusion()).toBe(false);
    expect(screen.getByTestId('main')).not.toHaveAttribute('data-skills-covered');
  });

  it('visits the TV first when an upward Contact flick crosses the entire Skills spacer', async () => {
    await mount();
    await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
    expect(isProjectsReturnOwed()).toBe(true);
    skillsTop = 2000;
    projectsTop = 6200;
    clock.wait(300);
    const event = new WheelEvent('wheel', { deltaY: -20000, bubbles: true, cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(projectPhase()).toBe('approaching');
    expect(skillPhase()).toBe('outside');
    expect(isProjectsReturnOwed()).toBe(false);
    expect(getProjectsView().entry).toBe('contact');
    await advance(PROJECTS_APPROACH_MS);
    expect(projectPhase()).toBe('reading');
  });

  it.each(['reduced motion', 'viewport fallback', 'navbar', 'unmount'])(
    'releases the retained return pose on %s even if Skills never becomes opaque', async mode => {
      await mount();
      await act(async () => publishSectionNavigation('projects', { source: 'navbar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Back to the scene' }));
      await advance(PROJECTS_APPROACH_MS);
      fireEvent.click(screen.getByRole('button', { name: 'Back to the scene' }));
      await advance(PROJECTS_TURN_MS);
      fireEvent.click(screen.getByRole('button', { name: 'Back to Skills' }));
      await advance(100);
      expect(skillPhase()).toBe('entering');
      expect(getProjectsView().active).toBe(true);
      if (mode === 'unmount') cleanup();
      else if (mode === 'navbar') {
        await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
      } else {
        if (mode === 'reduced motion') reduced = true;
        else fits = false;
        await act(async () => {
          mediaListeners.forEach((listeners, query) => listeners.forEach(listener => listener({
            matches: query.includes('reduced') ? reduced : query.includes('min-width') && fits,
          })));
        });
      }
      expect(getProjectsView().active).toBe(false);
      expect(document.querySelector('[data-skills-covered], [data-projects-covered]')).toBeNull();
      expect(document.querySelector('main[inert]')).toBeNull();
    },
  );
});
