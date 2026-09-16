import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture, type ScrollDirection } from '@/lib/scroll/scrollGesture';
import {
  publishSectionNavigation, subscribeSectionNavigation,
  type SectionNavigate, type SectionNavigationOptions,
} from '@/lib/scroll/sectionNavigation';
import { hasChapterOwnership, CHAPTER_OWNERSHIP_ATTRIBUTES } from '@/lib/scroll/chapterOwnership';
import {
  holdProjectsViewForSkills, registerProjectsSurface, setProjectsView,
  setProjectsReturnOwed, subscribeSkillsProjectsHandoff, type ProjectsPhase,
} from '@/lib/projects/projectsScene';
import { PROJECTS_APPROACH_MS, PROJECTS_STAGE_QUERY, PROJECTS_TURN_MS } from '@/lib/projects/tvScreen';
import { coverChapterBackground } from '../About/EducationRail/educationCover';
import { findScrollContainer, scrollContainerBy } from '../About/EducationRail/scrollContainer';

interface Refs {
  host: RefObject<HTMLElement>;
  stage: RefObject<HTMLDivElement>;
  surface: RefObject<HTMLDivElement>;
}

export function useProjectsFits(): boolean {
  const [fits, setFits] = useState(() => window.matchMedia(PROJECTS_STAGE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PROJECTS_STAGE_QUERY);
    const update = () => setFits(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return fits;
}

export function useProjectsPlayback(
  { host, stage, surface }: Refs,
  enabled: boolean,
  reduced: boolean,
  onNavigate?: SectionNavigate,
) {
  const [phase, setPhase] = useState<ProjectsPhase>('outside');
  const requestRef = useRef<((direction: -1 | 1) => void) | null>(null);
  const preferenceRef = useRef<(() => void) | null>(null);
  const resumeRef = useRef(false);
  const step = useCallback((direction: -1 | 1) => requestRef.current?.(direction), []);

  useEffect(() => {
    const rail = host.current;
    const panel = stage.current;
    const screen = surface.current;
    if (!enabled || !rail || !panel || !screen) return;

    const main = rail.closest('main');
    const previous = ['about', 'skills'].map(id => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const skills = document.getElementById('skills');
    const unregister = registerProjectsSurface(screen);
    let state: ProjectsPhase = 'outside';
    let active = false;
    let side: 'before' | 'after' = rail.getBoundingClientRect().bottom <= 0 ? 'after' : 'before';
    setProjectsReturnOwed(side === 'after');
    let wave: ScrollDirection | null = null;
    let bypass = false;
    let navigating = false;
    let pendingNavigation: string | null = null;
    let turn = 0;
    let approach = 0;
    let frame = 0;
    let lastTime = 0;
    let alive = true;
    let ownedInert = false;
    let uncover: (() => void) | null = null;
    let flight: {
      from: number; target: number; elapsed: number; duration: number;
      axis: 'turn' | 'approach'; complete: () => void;
    } | null = null;

    const changePhase = (next: ProjectsPhase) => {
      state = next;
      writeAttribute(panel, 'data-phase', next);
      setPhase(next);
    };
    const inert = () => {
      if (main && !main.hasAttribute('inert')) {
        main.setAttribute('inert', '');
        ownedInert = true;
      }
    };
    const show = () => {
      if (active) return;
      active = true;
      setProjectsReturnOwed(false);
      writeStyleProperty(screen, 'opacity', '0');
      writeAttribute(rail, 'data-projects-active', 'true');
      writeAttribute(panel, 'data-visible', 'true');
      uncover = coverChapterBackground(rail, panel, 'projects');
    };
    const cancel = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      flight = null;
    };
    const release = (keepCamera = false) => {
      cancel();
      active = false;
      if (keepCamera) holdProjectsViewForSkills();
      else setProjectsView(false, turn, approach);
      writeAttribute(rail, 'data-projects-active', null);
      writeAttribute(panel, 'data-visible', null);
      if (main && ownedInert) main.removeAttribute('inert');
      ownedInert = false;
      uncover?.();
      uncover = null;
      changePhase('outside');
    };
    const navigate = (target: string, options: SectionNavigationOptions = { immediate: true }) => {
      navigating = true;
      if (onNavigate) onNavigate(target, options);
      else {
        publishSectionNavigation(target, options);
        const destination = document.getElementById(target);
        if (destination) {
          const rect = destination.getBoundingClientRect();
          scrollContainerBy(findScrollContainer(rail),
            options.edge === 'end' ? rect.bottom - window.innerHeight + 80 : rect.top - 80);
        }
      }
      navigating = false;
    };
    const focusNavigation = (target: string) => {
      if (panel.contains(document.activeElement) || document.activeElement === document.body) {
        document.querySelector<HTMLButtonElement>(
          `button[data-ink-control="${target}"]:not([tabindex="-1"])`,
        )?.focus({ preventScroll: true });
      }
    };
    const leave = (target: 'skills' | 'contact') => {
      side = target === 'contact' ? 'after' : 'before';
      setProjectsReturnOwed(side === 'after');
      release(target === 'skills' && skills?.dataset.staged === 'true');
      focusNavigation(target);
      navigate(target, { immediate: true, ...(target === 'skills' ? { edge: 'end' as const } : {}) });
    };
    const wake = () => {
      if (!frame && alive && !document.hidden && flight) frame = requestAnimationFrame(tick);
    };
    const settled = (next: ProjectsPhase) => {
      changePhase(next);
      if (pendingNavigation !== null) release();
    };
    const run = (axis: 'turn' | 'approach', target: number, next: ProjectsPhase, complete: () => void) => {
      changePhase(next);
      if (getPrefersReducedMotion()) {
        if (axis === 'turn') turn = target;
        else approach = target;
        setProjectsView(true, turn, approach);
        complete();
        return;
      }
      flight = {
        axis, target, from: axis === 'turn' ? turn : approach, elapsed: 0,
        duration: axis === 'turn' ? PROJECTS_TURN_MS : PROJECTS_APPROACH_MS,
        complete,
      };
      lastTime = performance.now();
      wake();
    };
    function tick(now: number) {
      frame = 0;
      if (!alive || document.hidden || !flight) return;
      const movement = flight;
      movement.elapsed = Math.min(movement.duration, movement.elapsed + phaseFrameDelta(now - lastTime));
      lastTime = now;
      const value = movement.from + (movement.target - movement.from) * movement.elapsed / movement.duration;
      if (movement.axis === 'turn') turn = value;
      else approach = value;
      setProjectsView(true, turn, approach);
      if (movement.elapsed === movement.duration) {
        flight = null;
        movement.complete();
      }
      wake();
    }
    const ready = () => {
      cancel();
      show();
      inert();
      turn = approach = 1;
      setProjectsView(true, turn, approach, 'skills');
      settled('reading');
    };
    const enter = (from: 'skills' | 'contact') => {
      show();
      inert();
      pendingNavigation = null;
      turn = from === 'contact' ? 1 : 0;
      approach = 0;
      setProjectsView(true, turn, approach, from);
      if (getPrefersReducedMotion()) ready();
      else if (from === 'contact') run('approach', 1, 'approaching', () => settled('reading'));
      else run('turn', 1, 'turning', () => settled('framed'));
    };
    requestRef.current = direction => {
      if (document.hidden || flight || !active) return;
      if (state === 'framed') {
        if (direction > 0) run('approach', 1, 'approaching', () => settled('reading'));
        else run('turn', 0, 'unturning', () => settled('revealed'));
      } else if (state === 'reading') {
        if (direction < 0) run('approach', 0, 'retreating', () => settled('framed'));
        else run('approach', 0, 'departing', () => leave('contact'));
      } else if (state === 'revealed') {
        if (direction < 0) leave('skills');
        else run('turn', 1, 'turning', () => settled('framed'));
      }
    };

    function apply() {
      if (!alive || document.hidden || !rail?.isConnected || active || bypass ||
          previous.some(hasChapterOwnership)) return;
      const rect = rail.getBoundingClientRect();
      if (rect.height <= 0) return;
      if (side === 'after') {
        if (wave === 'up' && rect.bottom >= window.innerHeight - 96) enter('contact');
      } else if (rect.top <= 96 && wave !== 'up') {
        if (skills?.dataset.staged === 'true' && skills.dataset.skillsReleased !== 'true') return;
        enter('skills');
      }
    }

    const unsubscribeHandoff = subscribeSkillsProjectsHandoff(next => {
      bypass = false;
      pendingNavigation = null;
      side = 'before';
      if (next === 'withdrawing') {
        cancel();
        turn = approach = 0;
        show();
        setProjectsView(true, turn, approach, 'skills');
        changePhase('withdrawing');
      } else {
        inert();
        // The Skills exit carries the turn; the next request belongs to approach.
        if (getPrefersReducedMotion()) ready();
        else run('turn', 1, 'turning', () => settled('framed'));
      }
    });
    const ignoreTarget = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest('[data-projects-scrollable], [data-projects-tabs]');
    const unsubscribeGesture = subscribeScrollGesture(direction => {
      if (!active || document.hidden) return;
      requestRef.current?.(direction === 'down' ? 1 : -1);
    }, { ignoreTarget });
    const unsubscribeEntry = subscribeScrollGesture(direction => {
      if (active || document.hidden) return;
      wave = direction;
      bypass = false;
      pendingNavigation = null;
      apply();
    }, { startsOnly: true, ignoreTarget });
    const unsubscribeNavigation = subscribeSectionNavigation((target, options) => {
      if (navigating) return;
      wave = null;
      if (options?.source === 'navbar') {
        pendingNavigation = null;
        release();
        side = target === 'contact' ? 'after' : 'before';
        setProjectsReturnOwed(side === 'after');
        bypass = target !== 'projects';
        if (target === 'projects') queueMicrotask(() => {
          if (alive && !bypass) ready();
        });
      } else if (target !== 'projects') {
        bypass = true;
        pendingNavigation = target;
        side = target === 'contact' ? 'after' : 'before';
        setProjectsReturnOwed(side === 'after');
        if (!flight) release();
      } else if (!active) {
        bypass = false;
        pendingNavigation = null;
        queueMicrotask(() => {
          if (alive && !active && !bypass && !previous.some(hasChapterOwnership)) enter('skills');
        });
      }
    });
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        lastTime = performance.now();
        wake();
        apply();
      }
    };
    preferenceRef.current = () => {
      if (active && getPrefersReducedMotion()) ready();
    };
    const observer = new MutationObserver(apply);
    previous.forEach(owner => observer.observe(owner, {
      attributes: true,
      attributeFilter: [...CHAPTER_OWNERSHIP_ATTRIBUTES, 'data-skills-released'],
    }));
    const unsubscribeScroll = subscribeScrollProgress(apply);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    document.addEventListener('visibilitychange', visibility);
    if (resumeRef.current && rail.getBoundingClientRect().top <= 96) ready();
    else apply();

    return () => {
      resumeRef.current = active;
      alive = false;
      release();
      setProjectsReturnOwed(false);
      requestRef.current = null;
      preferenceRef.current = null;
      unregister();
      unsubscribeHandoff();
      unsubscribeGesture();
      unsubscribeEntry();
      unsubscribeNavigation();
      unsubscribeScroll();
      observer.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [host, stage, surface, enabled, onNavigate]);

  useEffect(() => { preferenceRef.current?.(); }, [reduced]);

  return { phase, step, visible: phase !== 'outside', ready: phase === 'reading' };
}
