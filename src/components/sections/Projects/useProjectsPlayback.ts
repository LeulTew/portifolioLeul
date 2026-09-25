import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { writeAttribute, writeStyleProperty, cachedElement } from '@/lib/dom/cachedElement';
import { createTranslatedPositionReader, translatedLayerOf } from '@/lib/scroll/translatedPosition';
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
  setProjectsReading, setProjectsReturnOwed, subscribeSkillsProjectsHandoff, type ProjectsPhase,
} from '@/lib/projects/projectsScene';
import { PROJECTS_APPROACH_MS, PROJECTS_STAGE_QUERY, PROJECTS_TURN_MS } from '@/lib/projects/tvScreen';
import { coverChapterBackground } from '../About/EducationRail/educationCover';
import { findScrollContainer, scrollContainerBy } from '@/lib/scroll/scrollContainer';
import { claimScrollKeys } from '@/lib/scroll/keyboardScroll';
import { landSectionFocus } from '@/lib/scroll/sectionLanding';
import { isProjectsReadingTarget } from './projectsInput';
import { projectsReturnKeyDelta } from './projectsReturnKey';
import { CONTACT_FLIGHT_MS } from '@/lib/camera/contactFlight';
import {
  beginContactFlight, getContactView, hasContactCamera, isContactPoseCommitted,
  parkContactSky, releaseContactSky, setContactProgress, subscribeContactPose,
} from '@/lib/contact/contactScene';
import { clearContactPresentation } from '@/lib/contact/contactPresentation';
import { setTVProjectPhase } from '@/lib/tv/tvState';

interface Refs {
  host: RefObject<HTMLElement>;
  stage: RefObject<HTMLDivElement>;
  surface: RefObject<HTMLDivElement>;
}

function isContactEditingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(
    '#contact input, #contact textarea, #contact select, #contact [contenteditable]:not([contenteditable="false"])',
  );
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
    // Follows drei's translated layer between layout changes: a rect per scroll publication
    // forced 672ms of layout in a cold 70s journey at 4x CPU (round 8 profile).
    const railPosition = createTranslatedPositionReader(rail, cachedElement(() => translatedLayerOf(rail)));
    const railLayout = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => railPosition.refresh());
    railLayout?.observe(main ?? rail);
    let state: ProjectsPhase = 'outside';
    let active = false;
    let side: 'before' | 'after' = rail.getBoundingClientRect().bottom <= 0 ? 'after' : 'before';
    setProjectsReturnOwed(side === 'after');
    let wave: ScrollDirection | null = null;
    let bypass = false;
    let continuedReturn = false;
    let afterContactEdit = false;
    let navigating = false;
    let pendingNavigation: string | null = null;
    let turn = 0;
    let approach = 0;
    let frame = 0;
    let lastTime = 0;
    let alive = true;
    let ownedInert = false;
    let uncover: (() => void) | null = null;
    let contactComplete: (() => void) | null = null;
    let flight: {
      from: number; target: number; elapsed: number; duration: number;
      axis: 'turn' | 'approach'; complete: () => void;
    } | null = null;

    const changePhase = (next: ProjectsPhase) => {
      state = next;
      setProjectsReading(next === 'reading');
      setTVProjectPhase(next);
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
      continuedReturn = false;
      afterContactEdit = false;
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
      contactComplete = null;
      clearContactPresentation();
    };
    const release = (keepCamera = false, keepSky = false) => {
      cancel();
      active = false;
      continuedReturn = false;
      afterContactEdit = false;
      wave = null;
      if (keepCamera) holdProjectsViewForSkills();
      else setProjectsView(false, turn, approach);
      if (!keepSky) releaseContactSky();
      writeAttribute(rail, 'data-projects-active', null);
      writeAttribute(panel, 'data-visible', null);
      if (main && ownedInert) main.removeAttribute('inert');
      ownedInert = false;
      writeAttribute(panel, 'data-contact-flight', null);
      writeStyleProperty(panel, '--contact-flight-progress', '');
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
    // Focus that was on the TV, or lost with it, continues where the reader has been carried.
    const focusNavigation = (target: string) => {
      if (panel.contains(document.activeElement) || document.activeElement === document.body) landSectionFocus(target);
    };
    const leave = (target: 'skills' | 'contact') => {
      side = target === 'contact' ? 'after' : 'before';
      setProjectsReturnOwed(side === 'after');
      release(target === 'skills' && skills?.dataset.staged === 'true', target === 'contact');
      if (target === 'contact') parkContactSky();
      continuedReturn = target === 'contact' && pendingNavigation === null;
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
    const finishContact = (complete: () => void) => {
      if (!hasContactCamera() || isContactPoseCommitted() || getPrefersReducedMotion()) complete();
      else contactComplete = complete;
    };
    const unsubscribeContactPose = subscribeContactPose(() => {
      const complete = contactComplete;
      if (!alive || !complete || !isContactPoseCommitted()) return;
      contactComplete = null;
      complete();
    });
    const run = (axis: 'turn' | 'approach', target: number, next: ProjectsPhase, complete: () => void) => {
      changePhase(next);
      const contact = getContactView().mode;
      const skyFlight = contact === 'departing' || contact === 'returning';
      writeAttribute(panel, 'data-contact-flight', skyFlight ? 'true' : null);
      if (skyFlight) writeStyleProperty(panel, '--contact-flight-progress', String(1 - approach));
      if (getPrefersReducedMotion()) {
        if (axis === 'turn') turn = target;
        else approach = target;
        if (skyFlight) setContactProgress(1 - approach);
        setProjectsView(true, turn, approach);
        complete();
        return;
      }
      flight = {
        axis, target, from: axis === 'turn' ? turn : approach, elapsed: 0,
        duration: skyFlight ? CONTACT_FLIGHT_MS : axis === 'turn' ? PROJECTS_TURN_MS : PROJECTS_APPROACH_MS,
        complete: skyFlight ? () => finishContact(complete) : complete,
      };
      lastTime = performance.now();
      wake();
    };
    const tick = (now: number) => {
      frame = 0;
      if (!alive || document.hidden || !flight) return;
      const movement = flight;
      movement.elapsed = Math.min(movement.duration, movement.elapsed + phaseFrameDelta(now - lastTime));
      lastTime = now;
      const value = movement.from + (movement.target - movement.from) * movement.elapsed / movement.duration;
      if (movement.axis === 'turn') turn = value;
      else approach = value;
      const contact = getContactView().mode;
      if (contact === 'departing' || contact === 'returning') {
        setContactProgress(1 - approach);
        writeStyleProperty(panel, '--contact-flight-progress', String(1 - approach));
      };
      setProjectsView(true, turn, approach);
      if (movement.elapsed === movement.duration) {
        flight = null;
        movement.complete();
      }
      wake();
    }
    const ready = () => {
      cancel();
      releaseContactSky();
      writeAttribute(panel, 'data-contact-flight', null);
      writeStyleProperty(panel, '--contact-flight-progress', '');
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
      else if (from === 'contact') {
        beginContactFlight(-1);
        run('approach', 1, 'approaching', () => {
          releaseContactSky();
          writeAttribute(panel, 'data-contact-flight', null);
          writeStyleProperty(panel, '--contact-flight-progress', '');
          settled('reading');
        });
      } else run('turn', 1, 'turning', () => settled('framed'));
    };
    requestRef.current = direction => {
      if (document.hidden || flight || contactComplete || !active) return;
      if (state === 'framed') {
        if (direction > 0) run('approach', 1, 'approaching', () => settled('reading'));
        else run('turn', 0, 'unturning', () => settled('revealed'));
      } else if (state === 'reading') {
        if (direction < 0) run('approach', 0, 'retreating', () => settled('framed'));
        else {
          beginContactFlight(1);
          run('approach', 0, 'departing', () => leave('contact'));
        }
      } else if (state === 'revealed') {
        if (direction < 0) leave('skills');
        else run('turn', 1, 'turning', () => settled('framed'));
      }
    };

    function apply() {
      if (!alive || document.hidden || !rail?.isConnected || active || bypass ||
          previous.some(hasChapterOwnership)) return;
      const { top, height } = railPosition.readRect();
      if (height <= 0) return;
      if (side === 'after') {
        if (wave === 'up' && top + height >= window.innerHeight - 96) enter('contact');
      } else if (top <= 96 && wave !== 'up') {
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
        releaseContactSky();
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
    const ignoreSceneTarget = (target: EventTarget | null) => {
      if (isContactEditingTarget(target)) {
        wave = null;
        afterContactEdit = side === 'after';
        return true;
      }
      return isProjectsReadingTarget(target);
    };
    const focusEditing = (event: Event) => {
      if (side !== 'after' || !isContactEditingTarget(event.target)) return;
      wave = null;
      afterContactEdit = true;
    };
    window.addEventListener('focusin', focusEditing, { passive: true });
    window.addEventListener('input', focusEditing, { passive: true });
    const unsubscribeGesture = subscribeScrollGesture(direction => {
      if (document.hidden) return;
      if (active) {
        requestRef.current?.(direction === 'down' ? 1 : -1);
      } else if ((continuedReturn || afterContactEdit) && direction === 'up') {
        wave = direction;
        if (afterContactEdit) {
          afterContactEdit = false;
          bypass = false;
          pendingNavigation = null;
        }
        apply();
      }
    }, { ignoreTarget: ignoreSceneTarget });
    const unsubscribeEntry = subscribeScrollGesture(direction => {
      if (active || document.hidden) return;
      wave = direction;
      bypass = false;
      pendingNavigation = null;
      apply();
    }, { startsOnly: true, ignoreTarget: ignoreSceneTarget });
    const forwardReturnKey = (event: KeyboardEvent) => {
      if (!active && side === 'after' && isContactEditingTarget(event.target)) {
        focusEditing(event);
        return;
      }
      if (document.hidden || active || side !== 'after' || bypass || wave !== 'up') return;
      const scroller = findScrollContainer(rail);
      if (!scroller) return;
      scrollContainerBy(scroller, projectsReturnKeyDelta(event, scroller));
    };
    window.addEventListener('keydown', forwardReturnKey, { passive: true });
    // While engaged, scroll keys are requests to the TV; parked after it, the return keys are this chapter's.
    const releaseKeys = claimScrollKeys(event => active ||
      (side === 'after' && (event.key === 'ArrowUp' || event.key === 'PageUp')));
    const unsubscribeNavigation = subscribeSectionNavigation((target, options) => {
      if (navigating) return;
      wave = null;
      continuedReturn = false;
      afterContactEdit = false;
      if (options?.source === 'navbar') {
        pendingNavigation = null;
        release();
        if (target === 'contact') parkContactSky();
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
        if (!flight && !contactComplete) release();
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
      if (!active || !getPrefersReducedMotion()) return;
      if (state === 'departing') {
        setContactProgress(1);
        leave('contact');
      } else ready();
    };
    const observer = new MutationObserver(apply);
    previous.forEach(owner => observer.observe(owner, {
      attributes: true,
      attributeFilter: [...CHAPTER_OWNERSHIP_ATTRIBUTES, 'data-skills-released'],
    }));
    const unsubscribeScroll = subscribeScrollProgress(apply);
    const resized = () => {
      railPosition.refresh();
      apply();
    };
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', resized);
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
      unsubscribeContactPose();
      unsubscribeScroll();
      observer.disconnect();
      railLayout?.disconnect();
      window.removeEventListener('keydown', forwardReturnKey);
      releaseKeys();
      window.removeEventListener('focusin', focusEditing);
      window.removeEventListener('input', focusEditing);
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [host, stage, surface, enabled, onNavigate]);

  useEffect(() => { preferenceRef.current?.(); }, [reduced]);

  return { phase, step, visible: phase !== 'outside', ready: phase === 'reading' };
}
