import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import { writeAttribute } from '@/lib/dom/cachedElement';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture, type ScrollDirection } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation, type SectionNavigate } from '@/lib/scroll/sectionNavigation';
import {
  finishProjectsSkillsReturn, isProjectsReturnOwed, publishSkillsProjectsHandoff,
} from '@/lib/projects/projectsScene';
import { findScrollContainer, scrollContainerBy } from '../About/EducationRail/scrollContainer';
import { coverChapterBackground } from '../About/EducationRail/educationCover';
import { createSkillsTimeline } from './skillsTimeline';
import { SKILLS_STAGE_QUERY } from './skillsData';

type Phase = 'outside' | 'entering' | 'reading' | 'crossing' | 'leaving';
type Direction = -1 | 1;
interface Refs {
  host: RefObject<HTMLElement>;
  stage: RefObject<HTMLDivElement>;
}

export function useSkillsStaged() {
  const reduced = usePrefersReducedMotion();
  const [fits, setFits] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(SKILLS_STAGE_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(SKILLS_STAGE_QUERY);
    const update = () => setFits(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return fits && !reduced;
}

export function useSkillsPlayback(
  { host, stage }: Refs,
  staged: boolean,
  onNavigate?: SectionNavigate,
) {
  const [active, setActive] = useState(0);
  const [settledIndex, setSettledIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('outside');
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const requestRef = useRef<((direction: Direction) => void) | null>(null);
  const selectRef = useRef<((index: number) => void) | null>(null);
  const step = useCallback((direction: Direction) => requestRef.current?.(direction), []);
  const select = useCallback((index: number) => selectRef.current?.(index), []);

  useEffect(() => {
    const rail = host.current;
    const panel = stage.current;
    if (!staged || !rail || !panel) return;

    const initialRect = rail.getBoundingClientRect();
    const main = rail.closest('main');
    const previouslyInert = main?.hasAttribute('inert') ?? false;
    let current = 0;
    let state: Phase = 'outside';
    let shown = false;
    let covered = false;
    let uncover: (() => void) | null = null;
    let side: 'before' | 'after' = initialRect.height > 0 && initialRect.bottom <= 0 ? 'after' : 'before';
    let wave: ScrollDirection | null = null;
    let bypass = false;
    let directlyRequested = false;
    let immediateEntry = false;
    let visited = false;
    let navigation: string | null = null;
    let frame = 0;
    let lastTime = 0;
    let alive = true;
    let observedOverlay: HTMLElement | null = null;
    let flight: { score: gsap.core.Timeline; target: number; complete: () => void } | null = null;
    let score: ReturnType<typeof createSkillsTimeline>;
    let departure: gsap.core.Timeline;

    const context = gsap.context(() => {
      score = createSkillsTimeline(panel);
      departure = gsap.timeline({ paused: true })
        .fromTo(panel, { opacity: 1, yPercent: 0 }, {
          opacity: 0, yPercent: -100, duration: 0.6, ease: 'power2.inOut', immediateRender: false,
        });
    }, panel);
    if (side === 'after') current = score!.stops.length - 1;
    setActive(current);
    setSettledIndex(current);
    setPhase('outside');
    setVisible(false);
    setReady(false);

    const cover = (value: boolean) => {
      if (value === covered) return;
      covered = value;
      if (value) uncover = coverChapterBackground(rail, panel, 'skills');
      else {
        uncover?.();
        uncover = null;
      }
      setOverlayOcclusion(value, 'skills');
    };
    const changePhase = (next: Phase) => {
      state = next;
      setPhase(next);
      setReady(next === 'reading');
    };
    const show = (value: boolean) => {
      shown = value;
      setVisible(value);
      writeAttribute(panel, 'data-visible', value ? 'true' : null);
      writeAttribute(rail, 'data-skills-active', value ? 'true' : null);
      if (main && !previouslyInert) writeAttribute(main, 'inert', value ? '' : null);
      if (!value) cover(false);
    };
    const wake = () => {
      if (frame || !alive || document.hidden) return;
      frame = requestAnimationFrame(tick);
    };
    const reading = () => {
      setSettledIndex(current);
      changePhase('reading');
      finishProjectsSkillsReturn();
      apply();
    };
    const run = (timeline: gsap.core.Timeline, target: number, complete: () => void) => {
      flight = { score: timeline, target, complete };
      lastTime = performance.now();
      wake();
    };

    // Only a visible movement owns frames; reading has no timer or ticker.
    function tick(now: number) {
      frame = 0;
      if (!alive || document.hidden) return;
      const elapsed = phaseFrameDelta(now - lastTime);
      lastTime = now;
      if (flight) {
        const playing = flight;
        const time = playing.score.time();
        const distance = playing.target - time;
        const next = time + Math.sign(distance) * Math.min(Math.abs(distance), elapsed / 1000);
        playing.score.time(next, true);
        cover(shown && state !== 'leaving' && Number(panel!.style.opacity) === 1);
        if (Math.abs(next - playing.target) < 0.0001) {
          flight = null;
          playing.complete();
        }
      }
      if (flight) wake();
    }

    const alignAfterRelease = (direction: Direction, control: boolean) => {
      if (navigation !== null) return;
      const rect = rail.getBoundingClientRect();
      const stillOnRail = direction > 0 ? rect.bottom > window.innerHeight : rect.top < 96;
      if (!stillOnRail) return;
      if (direction < 0 && !control) {
        // Natural reverse returns to Education's trailing edge; only the
        // explicitly labelled Back to About button jumps to About's heading.
        scrollContainerBy(findScrollContainer(rail), rect.top - window.innerHeight);
        return;
      }
      const targetId = direction > 0 ? 'projects' : 'about';
      if (onNavigate) onNavigate(targetId);
      else {
        const target = document.getElementById(targetId);
        if (target) scrollContainerBy(findScrollContainer(rail), target.getBoundingClientRect().top - 80);
      }
    };
    const leave = (direction: Direction, control = false) => {
      const ownedFocus = panel.contains(document.activeElement);
      changePhase('leaving');
      cover(false);
      const projectsHandoff = direction > 0 && navigation === null &&
        publishSkillsProjectsHandoff('withdrawing');
      const released = () => {
        const destination = navigation ?? (direction > 0 ? 'projects' : 'about');
        const returningToSkills = navigation === 'skills';
        show(false);
        writeAttribute(rail, 'data-skills-released', direction > 0 ? 'true' : null);
        side = returningToSkills || direction < 0 ? 'before' : 'after';
        changePhase('outside');
        if (returningToSkills) {
          directlyRequested = true;
          apply();
        } else if (projectsHandoff && navigation === null) {
          publishSkillsProjectsHandoff('revealed');
          if (onNavigate) onNavigate('projects', { immediate: true });
          else alignAfterRelease(direction, control);
        } else alignAfterRelease(direction, control);
        if (ownedFocus && (document.activeElement === document.body || panel.contains(document.activeElement))) {
          document.querySelector<HTMLButtonElement>(
            `button[data-ink-control="${destination}"]:not([tabindex="-1"])`,
          )?.focus({ preventScroll: true });
        }
      };
      if (direction < 0 && current === 0) run(score.timeline, 0, released);
      else {
        departure.pause(0, true);
        run(departure, departure.duration(), released);
      }
    };
    const claim = () => {
      navigation = null;
      directlyRequested = false;
      visited = true;
      writeAttribute(rail, 'data-skills-released', null);
      current = side === 'before' ? 0 : current;
      setActive(current);
      setSettledIndex(current);
      changePhase('entering');
      show(true);
      if (immediateEntry) {
        immediateEntry = false;
        departure.pause(0, true);
        score.timeline.pause(score.stops[current], true);
        cover(true);
        reading();
        return;
      }
      if (side === 'before') {
        departure.pause(0, true);
        score.timeline.pause(0, true);
        run(score.timeline, score.stops[0], reading);
      } else {
        score.timeline.pause(score.stops[current], true);
        departure.pause(departure.duration(), true);
        run(departure, 0, reading);
      }
    };
    const about = main?.querySelector<HTMLElement>('#about') ?? document.getElementById('about');
    const educationRail = about?.querySelector<HTMLElement>('[data-testid="education-rail"]');
    const otherChapterOwnsStage = () => {
      if (isProjectsReturnOwed() || document.getElementById('projects')?.dataset.projectsActive === 'true') return true;
      if (!about) return false;
      if (side === 'before' && !directlyRequested) {
        if (about.dataset.titleSettled !== 'true') return true;
        if (educationRail?.dataset.staged === 'true' && about.dataset.educationReleased !== 'true') return true;
      }
      if (about.dataset.educationActive === 'true' || about.dataset.educationReturning === 'true') return true;
      const aboutOverlay = document.querySelector<HTMLElement>('[data-pinned-sequence]');
      return aboutOverlay?.dataset.active === 'true';
    };

    function apply() {
      if (!alive || document.hidden || !rail?.isConnected) return;
      // PinnedSequence portals after its mount effect. Observe the actual
      // release, which can follow About's last flag after scrolling has stopped.
      if (!observedOverlay?.isConnected) {
        observedOverlay = document.querySelector<HTMLElement>('[data-pinned-sequence]');
        if (observedOverlay) observer.observe(observedOverlay, {
          attributes: true,
          attributeFilter: ['data-active'],
        });
      }
      if (state === 'reading' && navigation !== null) {
        leave(navigation === 'home' || navigation === 'about' ? -1 : 1);
        return;
      }
      if (state !== 'outside' || bypass || otherChapterOwnsStage()) return;
      const rect = rail!.getBoundingClientRect();
      if (rect.height <= 0) return;
      const entering = side === 'before'
        ? (directlyRequested || wave !== 'up') && rect.top <= 96
        : directlyRequested || (wave === 'up' && rect.bottom >= window.innerHeight - 96);
      if (entering) claim();
    }

    const request = (direction: Direction, control = false) => {
      if (document.hidden || state !== 'reading') return;
      const next = current + direction;
      if (next < 0 || next >= score.stops.length) {
        leave(direction, control);
        return;
      }
      current = next;
      setActive(next);
      changePhase('crossing');
      run(score.timeline, score.stops[next], reading);
    };
    requestRef.current = direction => request(direction, true);
    selectRef.current = index => {
      if (document.hidden || !shown || state === 'leaving') return;
      const stop = score.stops[index];
      if (stop === undefined) throw new RangeError(`Skills chapter ${index} does not exist.`);
      if (index === current && state === 'reading') return;
      cancelAnimationFrame(frame);
      frame = 0;
      flight = null;
      lastTime = 0;
      navigation = null;
      immediateEntry = false;
      directlyRequested = false;
      bypass = false;
      current = index;
      setActive(current);
      departure.pause(0, true);
      score.timeline.pause(stop, true);
      cover(true);
      reading();
    };
    const unsubscribeGesture = subscribeScrollGesture(direction => {
      if (document.hidden || state !== 'reading') return;
      wave = direction;
      bypass = false;
      navigation = null;
      request(direction === 'down' ? 1 : -1);
    });
    const unsubscribeEntryGesture = subscribeScrollGesture(direction => {
      if (state !== 'outside') return;
      wave = direction;
      bypass = false;
      navigation = null;
      apply();
    }, { startsOnly: true });
    const unsubscribeNavigation = subscribeSectionNavigation((target, options) => {
      if (options?.source === 'navbar') {
        const ownedFocus = panel.contains(document.activeElement);
        flight = null;
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        score.timeline.pause();
        departure.pause();
        show(false);
        changePhase('outside');
        wave = null;
        writeAttribute(rail, 'data-skills-released', null);
        side = target === 'home' || target === 'about' || target === 'skills' ? 'before' : 'after';
        current = side === 'before' ? 0 : score.stops.length - 1;
        setActive(current);
        setSettledIndex(current);
        bypass = target !== 'skills';
        directlyRequested = target === 'skills';
        immediateEntry = directlyRequested;
        navigation = directlyRequested ? null : target;
        if (ownedFocus) {
          document.querySelector<HTMLButtonElement>(
            `button[data-ink-control="${target}"]:not([tabindex="-1"])`,
          )?.focus({ preventScroll: true });
        }
        // Claim only after all previous owners have restored their covers.
        queueMicrotask(() => { if (alive) apply(); });
        return;
      }
      immediateEntry = false;
      if (target === 'skills') {
        bypass = false;
        navigation = state === 'leaving' ? 'skills' : null;
        directlyRequested = state === 'outside' || state === 'leaving';
        if (state === 'outside') {
          side = options?.edge === 'end' ? 'after' : 'before';
          if (side === 'after') current = score.stops.length - 1;
        }
      } else {
        bypass = true;
        directlyRequested = false;
        navigation = target;
        if (state === 'outside') {
          side = target === 'home' || target === 'about' ? 'before' : 'after';
          if (side === 'after' && !visited) {
            current = score.stops.length - 1;
            setActive(current);
          }
        }
      }
      apply();
    });
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        cover(false);
      } else {
        lastTime = performance.now();
        cover(shown && state !== 'leaving' && Number(panel.style.opacity) === 1);
        if (flight) wake();
        apply();
      }
    };
    const observer = new MutationObserver(apply);
    if (about) observer.observe(about, {
      attributes: true,
      attributeFilter: [
        'data-education-active', 'data-education-returning', 'data-education-released', 'data-title-settled',
        'data-title-active', 'data-head-pending', 'data-head-travelling',
      ],
    });
    if (educationRail) observer.observe(educationRail, {
      attributes: true,
      attributeFilter: ['data-staged'],
    });
    const unsubscribeScroll = subscribeScrollProgress(apply);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    document.addEventListener('visibilitychange', visibility);
    apply();

    return () => {
      alive = false;
      requestRef.current = null;
      selectRef.current = null;
      cancelAnimationFrame(frame);
      unsubscribeGesture();
      unsubscribeEntryGesture();
      unsubscribeNavigation();
      unsubscribeScroll();
      observer.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      document.removeEventListener('visibilitychange', visibility);
      writeAttribute(rail, 'data-skills-active', null);
      writeAttribute(rail, 'data-skills-released', null);
      if (main && !previouslyInert) writeAttribute(main, 'inert', null);
      cover(false);
      finishProjectsSkillsReturn();
      context.revert();
      score.dispose();
    };
  }, [host, stage, staged, onNavigate]);

  return { active, settledIndex, phase, ready, visible, step, select };
}
