import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDownRight, ArrowUpRight, X } from 'lucide-react';
import { ControlButton } from '@/components/ui/ControlButton';
import { cvData } from '@/data/cv';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { phaseFrameDelta, easeInOutCubic } from '@/lib/motion/triggeredPhase';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { getAvatarEchoFrame, subscribeAvatarEcho } from '@/lib/avatar/avatarEchoScene';
import {
  ECHO_BOUNDS, ECHO_DETAIL_LAYERS, ECHO_DURATION_MS, ECHO_POINT_VALUES, ECHO_RETURN_MS,
  avatarContourPath, avatarDetailPaths, echoArrival, echoComposition, echoCopyReveal, echoTransform, sampleAvatarContour,
  type EchoComposition,
} from '@/lib/avatar/avatarEchoGeometry';
import styles from './AvatarEcho.module.css';

type EchoPhase = 'idle' | 'arriving' | 'reading' | 'returning';
interface AvatarEchoProps {
  ready: boolean;
  flat: boolean;
  onActiveChange: (active: boolean) => void;
  onExplore: () => void;
}

export function AvatarEcho({ ready, flat, onActiveChange, onExplore }: AvatarEchoProps) {
  const sceneAvailable = useSyncExternalStore(subscribeAvatarEcho, () => getAvatarEchoFrame().available, () => false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const cutout = useRef<SVGPathElement>(null);
  const detail = useRef<Array<SVGPathElement | null>>([]);
  const clipId = useId();
  const drawing = useRef<SVGGElement>(null);
  const tether = useRef<SVGPathElement>(null);
  const panel = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  const [phase, setPhase] = useState<EchoPhase>('idle');
  const [atHome, setAtHome] = useState(true);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const motion = useRef({
    phase: 'idle' as EchoPhase, raf: 0, last: 0, elapsed: 0, sourceTime: 0,
    progress: 0, copy: 0, returnProgress: 0, returnCopy: 0,
    composition: null as EchoComposition | null,
    points: new Float32Array(ECHO_POINT_VALUES),
    current: new Float32Array(ECHO_POINT_VALUES),
    returnFrom: new Float32Array(ECHO_POINT_VALUES),
  });
  const available = ready && atHome && (flat || sceneAvailable);

  const stopFrame = useCallback(() => {
    const score = motion.current;
    cancelAnimationFrame(score.raf);
    score.raf = 0;
    score.last = 0;
  }, []);

  const finish = useCallback((focusTrigger: boolean) => {
    stopFrame();
    motion.current.phase = 'idle';
    restoreFocus.current = focusTrigger;
    setPhase('idle');
    onActiveChange(false);
  }, [onActiveChange, stopFrame]);

  const cancel = useCallback(() => {
    if (motion.current.phase === 'idle') return;
    // Stay inside the native scrollport when retiring its focused controls.
    if (panel.current?.contains(document.activeElement)) root.current?.focus({ preventScroll: true });
    finish(false);
  }, [finish]);

  const paint = useCallback(() => {
    const score = motion.current;
    root.current?.style.setProperty('--echo-copy', score.copy.toFixed(4));
    root.current?.style.setProperty('--echo-presence', score.progress.toFixed(4));
    if (!score.composition || !shape.current || !drawing.current) return;
    const { center, foot, x, y } = score.composition;
    const contour = avatarContourPath(score.points);
    shape.current.setAttribute('d', contour);
    cutout.current?.setAttribute('d', contour);
    avatarDetailPaths(score.points).forEach((path, index) => detail.current[index]?.setAttribute('d', path));
    drawing.current.setAttribute('transform', echoTransform(score.composition, score.progress));
    if (tether.current) {
      tether.current.setAttribute('d',
        `M${center} ${foot} C${center - 105 * score.progress} ${foot + 95 * score.progress} ` +
        `${center + x * score.progress + 90} ${foot + y * score.progress + 35} ` +
        `${center + x * score.progress} ${foot + y * score.progress}`);
    }
  }, []);

  const run = useCallback(() => {
    const frame = (now: number) => {
      const score = motion.current;
      score.raf = 0;
      if (document.hidden) { cancel(); return; }
      score.elapsed += phaseFrameDelta(score.last ? now - score.last : 0);
      score.last = now;
      if (score.phase === 'arriving') {
        sampleAvatarContour(score.sourceTime + score.elapsed / 1000, score.points);
        score.progress = echoArrival(score.elapsed);
        score.copy = echoCopyReveal(score.elapsed);
        paint();
        if (score.elapsed >= ECHO_DURATION_MS) {
          score.phase = 'reading';
          score.last = 0;
          setPhase('reading');
          return;
        }
      } else if (score.phase === 'returning') {
        const returned = easeInOutCubic(Math.min(1, score.elapsed / ECHO_RETURN_MS));
        sampleAvatarContour(getAvatarEchoFrame().time, score.current);
        for (let i = 0; i < score.points.length; i++) {
          score.points[i] = score.returnFrom[i] + (score.current[i] - score.returnFrom[i]) * returned;
        }
        score.progress = score.returnProgress * (1 - returned);
        score.copy = score.returnCopy * (1 - returned);
        paint();
        if (returned === 1) {
          finish(panel.current?.contains(document.activeElement) ?? false);
          return;
        }
      } else return;
      score.raf = requestAnimationFrame(frame);
    };
    motion.current.raf = requestAnimationFrame(frame);
  }, [cancel, finish, paint]);

  const open = () => {
    if (!available || motion.current.phase !== 'idle') return;
    const score = motion.current;
    score.elapsed = 0;
    score.last = 0;
    score.sourceTime = getAvatarEchoFrame().time;
    score.progress = 0;
    score.copy = 0;
    score.composition = echoComposition(viewport.width, viewport.height);
    sampleAvatarContour(score.sourceTime, score.points);
    const still = flat || getPrefersReducedMotion();
    score.phase = still ? 'reading' : 'arriving';
    if (still) { score.progress = 0; score.copy = 1; }
    setPhase(score.phase);
    onActiveChange(true);
  };

  const close = useCallback(() => {
    const score = motion.current;
    if (score.phase === 'idle' || score.phase === 'returning') return;
    if (flat || getPrefersReducedMotion()) {
      finish(panel.current?.contains(document.activeElement) ?? false);
      return;
    }
    stopFrame();
    score.returnFrom.set(score.points);
    score.returnProgress = score.progress;
    score.returnCopy = score.copy;
    score.elapsed = 0;
    score.phase = 'returning';
    setPhase('returning');
    run();
  }, [finish, flat, run, stopFrame]);

  useLayoutEffect(() => {
    if (phase === 'idle' && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
    if (phase === 'arriving' || phase === 'reading') {
      paint();
      if (phase === 'arriving' && !motion.current.raf) run();
      if (phase === 'arriving' || motion.current.elapsed === 0) heading.current?.focus({ preventScroll: true });
    }
  }, [phase, paint, run]);

  useEffect(() => {
    const measure = () => {
      const home = document.getElementById('home');
      setAtHome(Boolean(home && Math.abs(home.getBoundingClientRect().top) < 3));
    };
    const resize = () => {
      cancel();
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      measure();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const hidden = () => { if (document.hidden) cancel(); };
    const reduced = () => {
      if (!getPrefersReducedMotion() || motion.current.phase === 'idle') return;
      if (motion.current.phase === 'returning') {
        finish(panel.current?.contains(document.activeElement) ?? false);
        return;
      }
      stopFrame();
      motion.current.phase = 'reading';
      motion.current.elapsed = 1;
      motion.current.progress = 0;
      motion.current.copy = 1;
      paint();
      setPhase('reading');
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const releaseGesture = subscribeScrollGesture(cancel);
    const releaseProgress = subscribeScrollProgress(() => { measure(); });
    const releaseNavigation = subscribeSectionNavigation(cancel);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', key, { passive: true });
    document.addEventListener('visibilitychange', hidden);
    media.addEventListener('change', reduced);
    measure();
    return () => {
      stopFrame();
      releaseGesture(); releaseProgress(); releaseNavigation();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', key);
      document.removeEventListener('visibilitychange', hidden);
      media.removeEventListener('change', reduced);
    };
  }, [cancel, close, finish, paint, stopFrame]);

  useEffect(() => { if (!available) cancel(); }, [available, cancel]);

  const [left, top, right, bottom] = ECHO_BOUNDS;
  const bodyWidth = (right - left) * viewport.height / 1000;
  const hitWidth = Math.max(116, bodyWidth);
  const hitX = Math.min(viewport.width - hitWidth - 24,
    Math.max(24, viewport.width / 2 + ((left + right) / 2 - 500) * viewport.height / 1000 - hitWidth / 2));
  const hitY = top * viewport.height / 1000;
  const hitHeight = Math.max(48, (bottom - top) * viewport.height / 1000 + 44);
  const openPhase = phase !== 'idle';

  return (
    <div ref={root} className={styles.stage} data-avatar-echo={phase} data-flat={flat || undefined}
      tabIndex={-1}>
      <button ref={trigger} type="button" className={styles.trigger}
        hidden={!available} disabled={openPhase} aria-expanded={openPhase}
        aria-controls={openPhase ? 'avatar-hello' : undefined} aria-label="Say hello to Leul"
        style={flat ? undefined : { left: hitX, top: hitY, width: hitWidth, height: hitHeight }}
        onClick={open}>
        <span className={styles.invitation}>Say hello <ArrowUpRight size={15} aria-hidden="true" /></span>
      </button>
      {openPhase && <>
        <svg className={styles.art} viewBox="0 0 1000 1000" aria-hidden="true">
          <defs><clipPath id={clipId}><path ref={cutout} /></clipPath></defs>
          <path ref={tether} className={styles.tether} />
          <g ref={drawing}>
            <path ref={shape} className={styles.silhouette} pathLength="1" />
            <g clipPath={`url(#${clipId})`} className={styles.details}>
              {ECHO_DETAIL_LAYERS.map((layer, index) => (
                <path key={layer.name} ref={node => { detail.current[index] = node; }}
                  data-echo-detail={layer.name} fillRule="evenodd" />
              ))}
            </g>
          </g>
        </svg>
        <section ref={panel} id="avatar-hello" className={styles.hello} aria-labelledby="avatar-hello-title">
          <h2 ref={heading} id="avatar-hello-title" tabIndex={-1} className={styles.title}>
            <span>Oh,</span> <span>hi.</span>
          </h2>
          <p className={styles.introduction}>I'm Leul.<br />Software engineer, {cvData.contact.location}.</p>
          <p className={styles.aside}>Thought I'd step out for a second.</p>
          <div className={styles.actions}>
            <ControlButton variant="primary" onClick={() => { cancel(); onExplore(); }}>
              Keep exploring <ArrowDownRight size={18} aria-hidden="true" />
            </ControlButton>
            <a href={cvData.contact.social.github} target="_blank" rel="noopener noreferrer">
              GitHub <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <button type="button" className={styles.close} onClick={close}>
            <X size={18} aria-hidden="true" /> Back to the island <kbd>Esc</kbd>
          </button>
        </section>
      </>}
    </div>
  );
}
