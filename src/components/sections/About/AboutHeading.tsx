import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cachedElement, writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { firstGlyphInkOffset, fontShorthand } from '@/lib/motion/glyphInk';
import { advancePhase, easeInOutCubic, isPhaseAtTarget, phaseFrameDelta, phaseGate,
  PHASE_AT_REST, type PhaseState } from '@/lib/motion/triggeredPhase';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { HEAD_SETTLE } from './aboutBeats';
import { createAboutReader, createSeqReader } from './seqReader';
import { centeredHeading } from './headingGeometry';
import styles from './About.module.css';

const CENTER_REST_MS = 500;
const RETURN_FADE_MS = 280;
const properties = [
  '--head-travel', '--heading-presence', '--heading-enter-x', '--heading-enter-y',
  '--heading-enter-scale', '--heading-subtitle-x', '--heading-subtitle-y',
  '--heading-origin-x', '--heading-origin-y', '--heading-rest-x', '--heading-rest-y',
] as const;

export function AboutHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const findMirror = cachedElement(() => document.querySelector<HTMLElement>('[data-heading-mirror]'));
    const findCue = cachedElement(() => document.querySelector<HTMLElement>('[data-testid="scroll-cue"]'));
    const painted = new Set<HTMLElement>();
    const paint = (element: HTMLElement, property: string, value: string) => {
      painted.add(element);
      writeStyleProperty(element, property, value);
    };
    const home = document.getElementById('home');
    const readAbout = createAboutReader();
    const readSeq = createSeqReader(() => ref.current);
    let phase = PHASE_AT_REST;
    let presence: PhaseState = { t: 1, heading: 1 };
    let target = false;
    let moved = false;
    let wasEligible = false;
    let hold = 0;
    let frame = 0;
    let last = 0;
    let disposed = false;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const staticMotion = () => getPrefersReducedMotion() ||
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');

    const render = () => {
      const about = readAbout();
      if (!about) return;
      const leaving = moved && !target && phase.t <= 0 && presence.t > 0;
      const travel = easeInOutCubic(phase.t).toFixed(4);
      const opacity = presence.t.toFixed(4);
      paint(heading, '--head-travel', travel);
      paint(heading, '--heading-presence', opacity);
      const mirror = findMirror();
      if (mirror) {
        paint(mirror, '--head-travel', travel);
        paint(mirror, '--heading-presence', opacity);
      }
      const cue = findCue();
      if (cue) paint(cue, '--head-travel', travel);
      writeAttribute(about, 'data-head-settled', phase.t >= 1 ? 'true' : null);
      writeAttribute(about, 'data-head-pending', (target && phase.t < 1) || leaving ? 'true' : null);
      writeAttribute(about, 'data-head-travelling', phase.t > 0 && phase.t < 1 ? 'true' : null);
    };

    const running = () => (target && hold < CENTER_REST_MS) ||
      !isPhaseAtTarget(phase, target) ||
      !isPhaseAtTarget(presence, target || !moved || phase.t > 0);

    const step = (now: number) => {
      frame = 0;
      const dt = phaseFrameDelta(last ? now - last : 16.7);
      last = now;
      if (target && phase.t <= 0 && hold < CENTER_REST_MS) {
        hold = Math.min(CENTER_REST_MS, hold + dt);
      } else {
        phase = advancePhase(phase, target, dt, HEAD_SETTLE.durationMs);
      }
      if (phase.t > 0) moved = true;
      presence = advancePhase(presence, target || !moved || phase.t > 0, dt, RETURN_FADE_MS);
      if (!target && phase.t <= 0 && presence.t <= 0) hold = 0;
      render();
      if (running()) frame = requestAnimationFrame(step);
      else last = 0;
    };

    const update = () => {
      const about = readAbout();
      const eligible = !home || home.getAttribute('data-hero-handover-settled') === 'true';
      if (eligible && !wasEligible && phase.t <= 0 && presence.t <= 0) {
        presence = { t: 1, heading: 1 };
        moved = false;
      }
      wasEligible = eligible;
      target = (eligible && phaseGate(readSeq(), target, HEAD_SETTLE.enter, HEAD_SETTLE.exit)) ||
        about?.getAttribute('data-statements-present') === 'true';
      if (!target && phase.t <= 0) hold = 0;
      if (staticMotion()) {
        phase = { t: target ? 1 : 0, heading: target ? 1 : -1 };
        presence = { t: 1, heading: 1 };
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
      render();
      if (!running() && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
      }
      if (!staticMotion() && running() && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    const measure = () => {
      const title = heading.querySelector<HTMLElement>('[data-heading-title]');
      const subtitle = heading.querySelector<HTMLElement>('[data-heading-subtitle]');
      if (!title || !subtitle || title.offsetWidth <= 0) return;
      const style = getComputedStyle(heading);
      const left = parseFloat(style.paddingLeft);
      const top = parseFloat(style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      const pose = centeredHeading({
        viewportWidth: innerWidth, viewportHeight: innerHeight, left, top,
        titleWidth: title.offsetWidth, titleHeight: title.offsetHeight,
        subtitleWidth: subtitle.offsetWidth, subtitleHeight: subtitle.offsetHeight,
        subtitleTop: subtitle.offsetTop,
      });
      const text = title.querySelector('h2') ?? title;
      const ink = firstGlyphInkOffset(text.textContent ?? '', fontShorthand(getComputedStyle(text)));
      const values = {
        '--heading-enter-x': `${pose.titleX}px`,
        '--heading-enter-y': `${pose.titleY}px`,
        '--heading-enter-scale': String(pose.scale),
        '--heading-subtitle-x': `${pose.subtitleX}px`,
        '--heading-subtitle-y': `${pose.subtitleY}px`,
        '--heading-origin-x': `${left + pose.titleX + ink * pose.scale}px`,
        '--heading-origin-y': `${pose.originY}px`,
        '--heading-rest-x': `${left + ink}px`,
        '--heading-rest-y': `${top}px`,
      };
      let changed = false;
      const entries = Object.entries(values);
      for (const element of [heading, findMirror(), findCue()]) {
        if (!element) continue;
        for (const [property, value] of entries) {
          if (element.style.getPropertyValue(property) !== value) {
            paint(element, property, value);
            changed = true;
          }
        }
      }
      if (changed) window.dispatchEvent(new Event('about-heading-layout'));
    };
    const resize = () => { measure(); update(); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(heading);
    const title = heading.querySelector('[data-heading-title]');
    if (title) observer?.observe(title);
    const about = readAbout();
    const stateObserver = new MutationObserver(update);
    if (about) stateObserver.observe(about, {
      attributes: true, attributeFilter: ['data-statements-present'],
    });
    if (home) stateObserver.observe(home, {
      attributes: true, attributeFilter: ['data-hero-handover-settled'],
    });
    measure();
    update();
    const unsubscribe = subscribeScrollProgress(update);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', resize);
    motionQuery.addEventListener('change', resize);
    document.fonts?.ready.then(() => { if (!disposed) measure(); });
    return () => {
      disposed = true;
      unsubscribe();
      observer?.disconnect();
      stateObserver.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', resize);
      if (frame) cancelAnimationFrame(frame);
      for (const element of painted) {
        for (const property of properties) element.style.removeProperty(property);
      }
      if (about) {
        for (const name of ['data-head-settled', 'data-head-pending', 'data-head-travelling']) {
          writeAttribute(about, name, null);
        }
      }
    };
  }, []);

  return <div ref={ref} className={styles.heldHeader} data-testid="about-held-header">{children}</div>;
}
