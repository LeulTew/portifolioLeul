import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture, type ScrollDirection } from '@/lib/scroll/scrollGesture';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { BEAT_COOLDOWN_MS, askBeat, beatRequested, prepareBeatRequest, UNREQUESTED_BEAT } from '../aboutBeats';
import { openingTimeline, recordTimeline } from './educationMotion';
import { releaseOffset, stageVisible, trackOffset } from './railTransit';
import { findScrollContainer, scrollContainerBy } from './scrollContainer';

type Phase = 'outside' | 'waiting' | 'opening' | 'reading' | 'crossing' | 'closing' | 'returning';
type Ref = RefObject<HTMLDivElement | null>;
interface PlaybackRefs {
  rail: Ref;
  stage: Ref;
  pinned: Ref;
  frame: Ref;
  head: Ref;
  track: Ref;
}

export function useEducationPlayback(
  { rail, stage, pinned, frame, head, track }: PlaybackRefs,
  staged: boolean,
  total: number,
  onNavigate?: (section: string) => void
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
    writeAttribute(outline, 'data-open', null);
    writeAttribute(heading, 'data-settled', null);
    let current = 0;
    let state: Phase = 'outside';
    let side: 'before' | 'after' = 'before';
    let wave: ScrollDirection | null = null;
    let bypass = false;
    let navigation: string | null = null;
    let deadline = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let remaining = 0;
    let alive = true;
    let intro = UNREQUESTED_BEAT;
    let playing: gsap.core.Timeline | null = null;
    let open: gsap.core.Timeline;
    let exit: gsap.core.Timeline;
    const crossings = new Map<number, gsap.core.Timeline>();

    const changePhase = (next: Phase) => {
      state = next;
      setPhase(next);
      setReady(false);
    };
    const flag = (name: string, value: boolean) => {
      if (about) writeAttribute(about, name, value ? 'true' : null);
    };
    const show = (visible: boolean) => {
      writeAttribute(panel, 'data-visible', visible ? 'true' : null);
      if (about) writeAttribute(about, 'data-education-active', visible ? 'true' : null);
      setOverlayOcclusion(visible, 'education');
    };
    const clearWake = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const wake = () => {
      clearWake();
      if (document.hidden || deadline <= performance.now()) return;
      timer = setTimeout(() => {
        timer = null;
        apply();
      }, Math.max(1, deadline - performance.now()));
    };
    const reading = () => {
      if (!alive) return;
      playing = null;
      writeAttribute(heading, 'data-settled', 'true');
      changePhase('reading');
      deadline = performance.now() + BEAT_COOLDOWN_MS;
      wake();
    };
    const returned = () => {
      if (!alive) return;
      playing = null;
      show(false);
      writeAttribute(outline, 'data-open', null);
      writeAttribute(heading, 'data-settled', null);
      changePhase('returning');
      deadline = performance.now() + BEAT_COOLDOWN_MS;
      wake();
    };
    const departed = () => {
      if (!alive) return;
      playing = null;
      show(false);
      side = 'after';
      changePhase('outside');
      flag('data-education-returning', false);
    };
    const context = gsap.context(() => {
      gsap.set(strip, { xPercent: 0 });
      open = openingTimeline(heading, reading, returned);
      exit = gsap.timeline({ paused: true, onComplete: departed })
        .to(panel, { '--release': () => `${window.innerHeight}px`, duration: 0.75, ease: 'power2.inOut' });
    }, viewport);
    const positionTrack = gsap.quickSetter(strip, 'xPercent');

    const leave = (direction: -1 | 1) => {
      clearWake();
      changePhase('closing');
      if (direction < 0) {
        flag('data-education-returning', true);
        playing = open;
        if (open.progress() === 0) returned();
        else open.reverse();
      } else {
        setOverlayOcclusion(false, 'education');
        playing = exit;
        exit.invalidate().restart();
      }
      const rect = host.getBoundingClientRect();
      const needsAlignment = direction > 0 ? rect.bottom > window.innerHeight : rect.top < 0;
      if (navigation === null && needsAlignment) {
        if (onNavigate) onNavigate(direction > 0 ? 'skills' : 'about');
        else {
          scrollContainerBy(findScrollContainer(host), direction > 0
            ? Math.max(rect.bottom, 0)
            : Math.min(rect.top - 1, 0));
        }
      }
    };
    const cross = (next: number) => {
      current = next;
      setActive(next);
      changePhase('crossing');
      if (!crossings.has(next)) {
        context.add(() => {
          crossings.set(next, recordTimeline(strip, next, total, reading));
        });
      }
      playing = crossings.get(next)!;
      playing.invalidate().restart();
    };
    const claim = () => {
      clearWake();
      flag('data-education-returning', false);
      flag('data-education-owned', true);
      writeStyleProperty(panel, '--release', '0px');
      show(true);
      open.pause(0, true);
      positionTrack(trackOffset(current, total));
      changePhase('waiting');
      intro = prepareBeatRequest(UNREQUESTED_BEAT, true, performance.now());
      deadline = performance.now() + BEAT_COOLDOWN_MS;
      wake();
    };
    const releaseBack = () => {
      flag('data-education-owned', false);
      side = 'before';
      current = 0;
      setActive(0);
      changePhase('outside');
    };
    const apply = () => {
      if (!alive || document.hidden) return;
      if (state === 'opening' || state === 'crossing' || state === 'closing') return;
      const rect = host.getBoundingClientRect();
      const height = viewport.offsetHeight;
      const canEnter = !about || (about.dataset.titleSettled === 'true' &&
        about.dataset.titleActive !== 'true' && about.dataset.reverseTransitionActive !== 'true');
      const pastEnd = releaseOffset(rect.top, rect.height, height) >= height;
      if (about?.dataset.titleSettled !== 'true') flag('data-education-returning', false);

      if (state === 'outside') {
        if (!bypass && canEnter && ((side === 'before' && rect.top <= 0) ||
            (side === 'after' && wave === 'up' &&
              (stageVisible(rect.top, rect.height, height) || rect.top > 0)))) claim();
        return;
      }
      if (state === 'waiting') {
        if (!canEnter || performance.now() < deadline) return;
        if (navigation !== null && performance.now() >= deadline) {
          leave(navigation === 'home' || navigation === 'about' ? -1 : 1);
        } else if (beatRequested(intro, pastEnd || rect.top > 0, performance.now())) {
          changePhase('opening');
          writeAttribute(outline, 'data-open', 'true');
          playing = open;
          open.play();
        }
        return;
      }
      if (performance.now() < deadline) return;
      if (state === 'returning') {
        if (navigation !== null || !about || about.getBoundingClientRect().top >= 0) releaseBack();
        return;
      }
      if (state === 'reading') {
        setReady(true);
        if (navigation !== null) leave(navigation === 'home' || navigation === 'about' ? -1 : 1);
      }
    };
    const request = (direction: -1 | 1, control = false) => {
      if (document.hidden || state !== 'reading' || performance.now() < deadline) return;
      const next = current + direction;
      if (next >= 0 && next < total) cross(next);
      else if (!control) leave(direction);
    };
    requestRef.current = direction => request(direction, true);
    const unsubscribeGesture = subscribeScrollGesture(direction => {
      wave = direction;
      bypass = false;
      navigation = null;
      if (state === 'waiting') {
        if (performance.now() >= deadline &&
            (side === 'before' ? direction === 'up' : direction === 'down')) {
          leave(side === 'before' ? -1 : 1);
          return;
        }
        if (performance.now() >= deadline) intro = askBeat(intro, performance.now());
        apply();
      } else if (state === 'returning' && direction === 'up' && performance.now() >= deadline) {
        releaseBack();
      } else if (state === 'outside') {
        apply();
      } else {
        request(direction === 'down' ? 1 : -1);
      }
    }, { startsOnly: true });
    const unsubscribeNavigation = subscribeSectionNavigation(target => {
      bypass = true;
      navigation = target;
      if (state === 'outside') {
        if (target === 'home' || target === 'about') {
          flag('data-education-owned', false);
          flag('data-education-returning', false);
          side = 'before';
        }
      } else apply();
    });
    const visibility = () => {
      if (document.hidden) {
        remaining = Math.max(0, deadline - performance.now());
        clearWake();
        playing?.pause();
      } else {
        deadline = performance.now() + remaining;
        playing?.resume();
        wake();
        apply();
      }
    };
    const observer = about ? new MutationObserver(apply) : null;
    if (about) {
      observer?.observe(about, {
        attributes: true,
        attributeFilter: ['data-title-settled', 'data-title-active', 'data-reverse-transition-active'],
      });
    }
    const unsubscribeScroll = subscribeScrollProgress(apply);
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    document.addEventListener('visibilitychange', visibility);
    apply();

    return () => {
      alive = false;
      requestRef.current = null;
      clearWake();
      unsubscribeGesture();
      unsubscribeNavigation();
      unsubscribeScroll();
      observer?.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      document.removeEventListener('visibilitychange', visibility);
      show(false);
      flag('data-education-owned', false);
      flag('data-education-returning', false);
      context.revert();
    };
  }, [rail, stage, pinned, frame, head, track, staged, total, onNavigate]);

  return { active, phase, ready, step };
}
