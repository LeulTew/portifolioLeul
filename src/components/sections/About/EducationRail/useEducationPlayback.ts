import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture, type ScrollDirection } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation, type SectionNavigate } from '@/lib/scroll/sectionNavigation';
import { writeAttribute, writeStyleProperty, cachedElement } from '@/lib/dom/cachedElement';
import { createTranslatedPositionReader, translatedLayerOf } from '@/lib/scroll/translatedPosition';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { openingTimeline, recordTimeline } from './educationMotion';
import { createEducationReveal, EDUCATION_REVEAL_MS } from './educationReveal';
import { coverEducationBackground } from './educationCover';
import { isProjectsReturnOwed } from '@/lib/projects/projectsScene';
import { stageVisible, trackOffset } from './railTransit';
import { findScrollContainer, scrollContainerBy } from '@/lib/scroll/scrollContainer';

type Phase = 'outside' | 'opening' | 'reading' | 'crossing' | 'closing';
type Ref = RefObject<HTMLDivElement | null>;
interface PlaybackRefs {
  rail: Ref;
  stage: RefObject<HTMLElement | null>;
  pinned: Ref;
  frame: Ref;
  head: Ref;
  track: Ref;
}

export function useEducationPlayback(
  { rail, stage, pinned, frame, head, track }: PlaybackRefs,
  staged: boolean,
  total: number,
  onNavigate?: SectionNavigate
) {
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>('outside');
  const [ready, setReady] = useState(false);
  const requestRef = useRef<((direction: -1 | 1) => void) | null>(null);
  const step = useCallback((direction: -1 | 1) => requestRef.current?.(direction), []);

  useEffect(() => {
    const host = rail.current;
    const panel = stage.current;
    const viewport = pinned.current;
    const outline = frame.current;
    const heading = head.current;
    const strip = track.current;
    if (!host || !panel || !viewport || !outline || !heading || !strip) return;
    if (!staged) {
      writeAttribute(outline, 'data-open', 'true');
      writeAttribute(heading, 'data-settled', 'true');
      setActive(0);
      setReady(false);
      setPhase('outside');
      return;
    }

    const about = host.closest<HTMLElement>('#about') ?? document.getElementById('about');
    const skills = host.closest('main')?.querySelector<HTMLElement>('#skills') ??
      document.getElementById('skills');
    /*
     * `apply` runs on every scroll publication, after other consumers have
     * written that frame, so reading layout there forced a synchronous layout
     * per frame (74% of the journey's forced-read time). Scrolling moves only
     * the layer's transform: the rail's place is read from it, and sizes are
     * re-measured only when layout can have changed.
     */
    const position = createTranslatedPositionReader(host, cachedElement(() => translatedLayerOf(host)));
    let viewportHeight = viewport.offsetHeight;
    const remeasure = () => {
      position.refresh();
      viewportHeight = viewport.offsetHeight;
    };
    const layout = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure);
    layout?.observe(host.closest('main') ?? host);
    layout?.observe(viewport);
    writeAttribute(outline, 'data-open', null);
    writeAttribute(heading, 'data-settled', null);
    let current = 0;
    let state: Phase = 'outside';
    let side: 'before' | 'after' = 'before';
    let wave: ScrollDirection | null = null;
    let bypass = false;
    // Closing must not recycle the same completed title into another opening.
    let handoffPending = true;
    let navigation: string | null = null;
    let landing: 'about' | 'skills' | null = null;
    let aligning = false;
    let alive = true;
    let playing: gsap.core.Timeline | null = null;
    let open: gsap.core.Timeline;
    let exit: gsap.core.Timeline;
    const crossings = new Map<number, gsap.core.Timeline>();
    let reveal: ReturnType<typeof createEducationReveal> | null = null;
    let uncover: (() => void) | null = null;
    const clearReveal = () => {
      reveal?.revert();
      reveal = null;
      writeAttribute(panel, 'data-reveal', null);
    };
    const prepareReveal = (direction: -1 | 1) => {
      clearReveal();
      const record = strip.querySelector<HTMLElement>(`[data-record="${current}"]`);
      if (!record) throw new Error(`Education record ${current} is not mounted`);
      reveal = createEducationReveal(record, direction);
      writeAttribute(panel, 'data-reveal', 'true');
    };
    const paintReveal = (progress: number) => {
      reveal?.seek(progress * EDUCATION_REVEAL_MS, true);
    };

    const changePhase = (next: Phase) => {
      state = next;
      setPhase(next);
      setReady(false);
    };
    const flag = (name: string, value: boolean) => {
      if (about) writeAttribute(about, name, value ? 'true' : null);
    };
    const show = (visible: boolean) => {
      if (visible && !uncover) uncover = coverEducationBackground(host, panel);
      else if (!visible) {
        uncover?.();
        uncover = null;
        writeAttribute(panel, 'data-reveal', null);
      }
      writeAttribute(panel, 'data-visible', visible ? 'true' : null);
      if (about) writeAttribute(about, 'data-education-active', visible ? 'true' : null);
      setOverlayOcclusion(visible, 'education');
    };
    const align = (target: 'about' | 'skills', immediate = false) => {
      if (onNavigate) {
        aligning = true;
        try {
          if (immediate) onNavigate(target, { immediate: true });
          else onNavigate(target);
        } finally {
          aligning = false;
        }
      } else {
        const rect = host.getBoundingClientRect();
        scrollContainerBy(findScrollContainer(host), target === 'skills'
          ? rect.bottom
          : Math.min(rect.top - 1, about?.getBoundingClientRect().top ?? 0));
      }
    };
    const settleLanding = () => {
      if (landing === null) return;
      const target = landing;
      landing = null;
      align(target, true);
    };
    const reading = () => {
      if (!alive) return;
      playing = null;
      clearReveal();
      writeAttribute(heading, 'data-settled', 'true');
      changePhase('reading');
      apply();
    };
    const returned = () => {
      if (!alive) return;
      playing = null;
      settleLanding();
      show(false);
      writeAttribute(outline, 'data-open', null);
      writeAttribute(heading, 'data-settled', null);
      reveal?.revert();
      reveal = null;
      releaseBack();
    };
    const departed = () => {
      if (!alive) return;
      playing = null;
      settleLanding();
      show(false);
      side = 'after';
      flag('data-education-released', true);
      changePhase('outside');
      flag('data-education-returning', false);
    };
    const context = gsap.context(() => {
      gsap.set(strip, { xPercent: 0 });
      open = openingTimeline(heading, reading, returned, paintReveal);
      exit = gsap.timeline({ paused: true, onComplete: departed })
        .to(panel, { '--release': () => `${window.innerHeight}px`, duration: 0.75, ease: 'power2.inOut' });
    }, viewport);
    const positionTrack = gsap.quickSetter(strip, 'xPercent');

    const leave = (direction: -1 | 1) => {
      changePhase('closing');
      if (direction < 0) {
        clearReveal();
        flag('data-education-returning', true);
        playing = open;
        if (open.progress() === 0) returned();
        else open.reverse();
      } else {
        uncover?.();
        uncover = null;
        setOverlayOcclusion(false, 'education');
        playing = exit;
        exit.invalidate().restart();
      }
      const rect = host.getBoundingClientRect();
      const aboutTop = direction < 0 ? about?.getBoundingClientRect().top ?? 0 : 0;
      // Wheel travel spent under this reader must not skip the next section.
      const needsAlignment = direction > 0 || rect.top < 0 || aboutTop < 0;
      if (navigation === null && needsAlignment) {
        landing = direction > 0 ? 'skills' : 'about';
        align(landing);
      }
    };
    const cross = (next: number) => {
      const direction = next > current ? 1 : -1;
      current = next;
      setActive(next);
      changePhase('crossing');
      prepareReveal(direction);
      if (!crossings.has(next)) {
        context.add(() => {
          crossings.set(next, recordTimeline(strip, next, total, reading, paintReveal));
        });
      }
      playing = crossings.get(next)!;
      playing.invalidate().restart();
    };
    const claim = () => {
      handoffPending = false;
      flag('data-education-released', false);
      flag('data-education-returning', false);
      flag('data-education-owned', true);
      writeStyleProperty(panel, '--release', '0px');
      show(true);
      open.pause(0, true);
      positionTrack(trackOffset(current, total));
      writeAttribute(heading, 'data-settled', null);
      changePhase('opening');
      writeAttribute(outline, 'data-open', 'true');
      prepareReveal(wave === 'up' ? -1 : 1);
      playing = open;
      open.play();
    };
    const releaseBack = () => {
      flag('data-education-released', false);
      flag('data-education-owned', false);
      side = 'before';
      current = 0;
      setActive(0);
      changePhase('outside');
    };
    const apply = () => {
      if (!alive || document.hidden) return;
      if (state === 'opening' || state === 'crossing' || state === 'closing') return;
      let rect = position.readRect();
      // Drei briefly detaches its HTML layer when the scroll track is rebuilt.
      // An unmeasured rail re-reads layout until it has one; a zero rect is
      // still not a return to the beginning of the Education rail.
      if (rect.height <= 0 || viewportHeight <= 0) {
        remeasure();
        rect = position.readRect();
      }
      const height = viewportHeight;
      if (!host.isConnected || rect.height <= 0 || height <= 0) return;
      const canEnter = !about || (about.dataset.titleSettled === 'true' &&
        about.dataset.titleActive !== 'true' && about.dataset.reverseTransitionActive !== 'true');
      if (about?.dataset.titleSettled !== 'true') flag('data-education-returning', false);

      if (state === 'outside') {
        if (about && about.dataset.titleSettled !== 'true') handoffPending = true;
        if (isProjectsReturnOwed() || skills?.dataset.skillsActive === 'true' ||
            document.getElementById('projects')?.dataset.projectsActive === 'true') return;
        if (!bypass && canEnter && ((side === 'before' && handoffPending && wave !== 'up' &&
            (about !== null || rect.top <= 0)) ||
            (side === 'after' && wave === 'up' &&
              (stageVisible(rect.top, rect.height, height) || rect.top > 0)))) claim();
        return;
      }
      if (state === 'reading') {
        setReady(true);
        if (navigation !== null) leave(navigation === 'home' || navigation === 'about' ? -1 : 1);
      }
    };
    const request = (direction: -1 | 1, control = false) => {
      if (document.hidden || state !== 'reading') return;
      const next = current + direction;
      if (next >= 0 && next < total) cross(next);
      else if (!control) leave(direction);
    };
    requestRef.current = direction => request(direction, true);
    const unsubscribeGesture = subscribeScrollGesture(direction => {
      wave = direction;
      bypass = false;
      navigation = null;
      if (state === 'outside') {
        if (direction === 'down') handoffPending = true;
        apply();
      } else {
        request(direction === 'down' ? 1 : -1);
      }
    }, { startsOnly: true });
    const unsubscribeNavigation = subscribeSectionNavigation((target, options) => {
      if (options?.source === 'navbar') {
        landing = null;
        playing?.pause();
        playing = null;
        clearReveal();
        show(false);
        open.pause(0, true);
        exit.pause(0, true);
        writeAttribute(outline, 'data-open', null);
        writeAttribute(heading, 'data-settled', null);
        flag('data-education-owned', false);
        flag('data-education-released', false);
        flag('data-education-returning', false);
        bypass = true;
        navigation = target;
        wave = null;
        handoffPending = false;
        side = target === 'home' || target === 'about' ? 'before' : 'after';
        current = side === 'before' ? 0 : total - 1;
        setActive(current);
        positionTrack(trackOffset(current, total));
        changePhase('outside');
        return;
      }
      if (!aligning) landing = null;
      bypass = true;
      navigation = target;
      if (state === 'outside') {
        if (target === 'home' || target === 'about') {
          flag('data-education-owned', false);
          flag('data-education-released', false);
          flag('data-education-returning', false);
          side = 'before';
          current = 0;
          setActive(0);
        } else if (target === 'skills' || target === 'projects' || target === 'contact') {
          side = 'after';
        }
      } else apply();
    });
    const visibility = () => {
      if (document.hidden) {
        playing?.pause();
      } else {
        playing?.resume();
        apply();
      }
    };
    const observer = new MutationObserver(apply);
    /*
     * Started where the reader actually is. The stage mounts again whenever the
     * window crosses the compact size, and a fresh "before, handoff pending"
     * state claimed Education over Projects the moment About's title had ever
     * settled. Past the rail nothing is owed; returning up still opens its last
     * record through the ordinary upward entry.
     */
    const placed = host.getBoundingClientRect();
    // An unmeasured, zero-height rail says nothing about where the reader is.
    if (placed.height > 0 && placed.bottom <= 0) {
      side = 'after';
      handoffPending = false;
      current = total - 1;
      setActive(current);
      positionTrack(trackOffset(current, total));
    }
    if (about) {
      observer.observe(about, {
        attributes: true,
        attributeFilter: ['data-title-settled', 'data-title-active', 'data-reverse-transition-active'],
      });
    }
    if (skills) observer.observe(skills, {
      attributes: true,
      attributeFilter: ['data-skills-active'],
    });
    const unsubscribeScroll = subscribeScrollProgress(apply);
    const resize = () => {
      remeasure();
      apply();
    };
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    apply();

    return () => {
      alive = false;
      requestRef.current = null;
      unsubscribeGesture();
      unsubscribeNavigation();
      unsubscribeScroll();
      observer.disconnect();
      layout?.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      show(false);
      flag('data-education-owned', false);
      flag('data-education-released', false);
      flag('data-education-returning', false);
      reveal?.revert();
      context.revert();
    };
  }, [rail, stage, pinned, frame, head, track, staged, total, onNavigate]);

  return { active, phase, ready, step };
}
