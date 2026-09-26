import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { phaseFrameDelta } from '@/lib/motion/triggeredPhase';
import { writeAttribute, cachedElement } from '@/lib/dom/cachedElement';
import { createTranslatedPositionReader, translatedLayerOf } from '@/lib/scroll/translatedPosition';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture, type ScrollDirection } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation, publishSectionNavigation, type SectionNavigate } from '@/lib/scroll/sectionNavigation';
import {
  finishProjectsSkillsReturn, isProjectsReturnOwed, publishSkillsProjectsHandoff,
} from '@/lib/projects/projectsScene';
import { findScrollContainer, scrollContainerBy } from '@/lib/scroll/scrollContainer';
import { landSectionFocus } from '@/lib/scroll/sectionLanding';
import { claimView } from '@/lib/scroll/viewOwner';
import { coverChapterBackground } from '../About/EducationRail/educationCover';
import { createSkillsTimeline } from './skillsTimeline';
import { SKILLS_STAGE_QUERY, skillChapterId } from './skillsData';

type Phase = 'outside' | 'entering' | 'reading' | 'crossing' | 'leaving';
type Direction = -1 | 1;
interface Refs {
  host: RefObject<HTMLElement>;
  stage: RefObject<HTMLElement>;
}

/** The reader's own moves: any of them outranks a chapter still waiting to be resumed. */
const READER_INPUTS = ['wheel', 'keydown', 'pointerdown', 'touchstart'] as const;
/** The line, as a share of the window's height, a chapter has to pass to be the one being read. */
const READING_LINE = 0.4;

/** Focus went with a layout that has been replaced: nothing, the page, or an element no longer in it. */
const focusLost = () => {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
};

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
  /**
   * The chapter a reader of Skills is on, carried across a change between the
   * staged reader and the linear page -- a motion preference turned on or off,
   * or a window crossing the stage's size -- so the layout that mounts goes on
   * with it. The staged reader otherwise came back empty, waiting for a gesture
   * to claim it, and the linear page opened on another chapter (round 14,
   * D-MOTION-001).
   */
  const resumeRef = useRef<number | null>(null);
  const step = useCallback((direction: Direction) => requestRef.current?.(direction), []);
  const select = useCallback((index: number) => selectRef.current?.(index), []);

  useEffect(() => {
    const rail = host.current;
    const panel = stage.current;
    if (!staged || !rail || !panel) return;

    const initialRect = rail.getBoundingClientRect();
    const main = rail.closest('main');
    let viewClaim: (() => void) | null = null;
    // As in Education: apply runs on every scroll publication, so the rail's
    // place comes from the layer's transform and sizes only from layout changes.
    const position = createTranslatedPositionReader(rail, cachedElement(() => translatedLayerOf(rail)));
    const layout = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => position.refresh());
    layout?.observe(main ?? rail);
    const findAboutOverlay = cachedElement(() => document.querySelector<HTMLElement>('[data-pinned-sequence]'));
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
    // Kept until the reader's own input or a navigation elsewhere: a track rebuilt under the
    // resuming navigation takes it again, and that repeat lands on the same chapter.
    let resumeAt = resumeRef.current;
    resumeRef.current = null;
    let resumeFrame = 0;

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
      // A landing waiting on Skills does not age while its stage is still coming in.
      writeAttribute(panel, 'data-arriving', next === 'entering' ? 'true' : null);
    };
    const show = (value: boolean) => {
      shown = value;
      setVisible(value);
      writeAttribute(panel, 'data-visible', value ? 'true' : null);
      writeAttribute(rail, 'data-skills-active', value ? 'true' : null);
      if (value) viewClaim ??= claimView('skills', main);
      else {
        viewClaim?.();
        viewClaim = null;
      }
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
      // The reader is handed to the neighbouring chapter however far the document ran on
      // beneath the hold: the gestures this chapter consumed were requests for its own
      // chapters, not travel past the next one. Wheeling the flat page past the last skill
      // otherwise landed on Contact, Projects skipped (round 9, D-FLAT-003).
      const rect = rail.getBoundingClientRect();
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
        // Focus that was on the reader, or lost with it, continues where the reader has been carried.
        if (ownedFocus && (document.activeElement === document.body || panel.contains(document.activeElement))) {
          landSectionFocus(destination);
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
      const resuming = resumeAt !== null;
      current = resumeAt ?? (side === 'before' ? 0 : current);
      setActive(current);
      setSettledIndex(current);
      changePhase('entering');
      show(true);
      // A resumed reader was already reading: its chapter is shown as it was, without an entrance.
      if (immediateEntry || resuming) {
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
      return findAboutOverlay()?.dataset.active === 'true';
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
      let rect = position.readRect();
      // Drei briefly detaches its layer while rebuilding the track; measure again until it has a size.
      if (rect.height <= 0) {
        position.refresh();
        rect = position.readRect();
      }
      if (rect.height <= 0) return;
      const entering = side === 'before'
        ? (directlyRequested || wave !== 'up') && rect.top <= 96
        : directlyRequested || (wave === 'up' && rect.top + rect.height >= window.innerHeight - 96);
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
      resumeAt = null;
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
        // A new choice, even of Skills itself, starts afresh; only the resume's own navigation continues it.
        if (target !== 'skills' || !options?.resume) resumeAt = null;
        current = resumeAt ?? (side === 'before' ? 0 : score.stops.length - 1);
        setActive(current);
        setSettledIndex(current);
        bypass = target !== 'skills';
        directlyRequested = target === 'skills';
        immediateEntry = directlyRequested;
        navigation = directlyRequested ? null : target;
        if (ownedFocus) {
          // Held on the navbar's entry while the destination settles, then landed in it.
          document.querySelector<HTMLButtonElement>(
            `button[data-ink-control="${target}"]:not([tabindex="-1"])`,
          )?.focus({ preventScroll: true });
          landSectionFocus(target);
        } else if (resumeAt !== null && focusLost()) {
          // Focus went with the layout it was in; it continues in the reader that replaced it.
          landSectionFocus(target);
        }
        // Claim only after all previous owners have restored their covers.
        queueMicrotask(() => { if (alive) apply(); });
        return;
      }
      immediateEntry = false;
      if (target !== 'skills' || !options?.resume) resumeAt = null;
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
    const resize = () => {
      position.refresh();
      apply();
    };
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    const forget = () => { resumeAt = null; };
    for (const type of READER_INPUTS) window.addEventListener(type, forget, { capture: true, passive: true });
    apply();
    if (resumeAt !== null) {
      // Taken as the navbar takes Skills, which settles every chapter around it -- two frames on,
      // once the page has measured this layout, so a track rebuilding for it takes the
      // navigation again after its rebuild instead of landing on the geometry it leaves (App).
      resumeFrame = requestAnimationFrame(() => {
        resumeFrame = requestAnimationFrame(() => {
          resumeFrame = 0;
          if (alive && resumeAt !== null) (onNavigate ?? publishSectionNavigation)('skills', { source: 'navbar', resume: true });
        });
      });
    }

    return () => {
      // The reader goes on with this chapter in whatever layout replaces this one.
      resumeRef.current = shown && state !== 'leaving' ? current : resumeAt;
      alive = false;
      requestRef.current = null;
      selectRef.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resumeFrame);
      for (const type of READER_INPUTS) window.removeEventListener(type, forget, { capture: true });
      unsubscribeGesture();
      unsubscribeEntryGesture();
      unsubscribeNavigation();
      unsubscribeScroll();
      observer.disconnect();
      layout?.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      writeAttribute(rail, 'data-skills-active', null);
      writeAttribute(rail, 'data-skills-released', null);
      writeAttribute(panel, 'data-arriving', null);
      viewClaim?.();
      viewClaim = null;
      cover(false);
      finishProjectsSkillsReturn();
      context.revert();
      score.dispose();
    };
  }, [host, stage, staged, onNavigate]);

  // The linear page: lands on a chapter carried from the staged reader, and keeps the one being read.
  useEffect(() => {
    const rail = host.current;
    const panel = stage.current;
    if (staged || !rail || !panel) return;
    /**
     * The chapter this layout is taking the reader back to, for as long as the resume
     * lasts: its placement, the replay of that placement after a track rebuild, and the
     * focus landing are all one lifetime, which the reader's own input or any newer
     * destination ends (round 15, TECH-050).
     */
    let resuming = resumeRef.current;
    let placing = 0;
    let sampling = 0;
    const land = () => {
      if (resuming === null || !focusLost()) return;
      panel.querySelector<HTMLElement>(`#${skillChapterId(resuming)} [data-skill-landing]`)?.focus({ preventScroll: true });
    };
    const retire = () => {
      cancelAnimationFrame(placing);
      placing = 0;
      resuming = null;
    };
    // Every scroll moves the reader's place, a scrollbar drag however long included (round 15,
    // TECH-053) -- except before the resume has placed them, when the place is the layout's.
    const sample = () => {
      sampling = 0;
      if (placing) return;
      const line = window.innerHeight * READING_LINE;
      const area = rail.getBoundingClientRect();
      if (area.top > line || area.bottom <= line) {
        resumeRef.current = null;
        return;
      }
      let chapter = 0;
      panel.querySelectorAll<HTMLElement>('[data-skill-chapter]').forEach((article, index) => {
        if (article.getBoundingClientRect().top <= line) chapter = index;
      });
      resumeRef.current = chapter;
    };
    const onScroll = () => {
      if (!sampling) sampling = requestAnimationFrame(sample);
    };
    const stopNavigation = subscribeSectionNavigation((target, options) => {
      // A rebuilt track taking the resume again detached the layer, and focus with it.
      if (target === 'skills' && options?.resume) {
        land();
        return;
      }
      retire();
      if (target !== 'skills') resumeRef.current = null;
    });
    if (resuming !== null) {
      // As the staged reader resumes: two frames on, through navigation (see above). Focus lost
      // with the staged reader lands on the chapter's own title, where Tab continues from.
      const chapter = resuming;
      placing = requestAnimationFrame(() => {
        placing = requestAnimationFrame(() => {
          placing = 0;
          (onNavigate ?? publishSectionNavigation)('skills', chapter > 0
            ? { source: 'navbar', resume: true, anchor: skillChapterId(chapter) }
            : { source: 'navbar', resume: true });
        });
      });
    }
    for (const type of READER_INPUTS) window.addEventListener(type, retire, { capture: true, passive: true });
    // Capture hears the 3D page's own scrolling element as well as the document.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const unsubscribeScroll = subscribeScrollProgress(onScroll);
    return () => {
      cancelAnimationFrame(sampling);
      retire();
      stopNavigation();
      unsubscribeScroll();
      for (const type of READER_INPUTS) window.removeEventListener(type, retire, { capture: true });
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [host, stage, staged, onNavigate]);

  return { active, settledIndex, phase, ready, visible, step, select };
}
