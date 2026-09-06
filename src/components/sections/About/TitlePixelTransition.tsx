import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import {
  advancePhase,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import {
  startAnimation,
  endAnimation,
  subscribeScrollIntent,
} from '@/lib/scroll/animationScrollGate';
import styles from './TitlePixelTransition.module.css';

export interface TitlePixelTransitionProps {
  /** Sequence progress where title pixel dissolve begins. Default: 0.86 */
  start?: number;
  /** Sequence progress where "Education" is fully written and locked in place. Default: 0.94 */
  end?: number;
  /** Consistent animation duration in milliseconds. Default: 1500 (slower, unhurried reveal) */
  durationMs?: number;
  initialTitle?: string;
  initialSubtitle?: string;
  flippedTitle?: string;
  flippedSubtitle?: string;
  className?: string;
  testId?: string;
  /** Explicit progress override for deterministic testing or manual scrub. */
  progress?: number;
}

interface PixelDotData {
  id: string;
  row: number;
  col: number;
  threshold: number;
}

function generateDots(cols: number, rows: number): PixelDotData[] {
  const dots: PixelDotData[] = [];
  let index = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sweep = c / Math.max(1, cols - 1);
      const seed = ((c + 1) * 31 + (r + 1) * 47) % 100;
      const colCluster = (((Math.floor(c / 2) + 1) * 23 + (r + 1) * 29) % 100) / 100;
      // 55% left-to-right sweep + 30% organic column cluster + 15% noise
      const raw = sweep * 0.55 + colCluster * 0.30 + (seed / 100) * 0.15;
      const threshold = Number(Math.min(1, Math.max(0, raw)).toFixed(3));

      dots.push({
        id: `dot-${index++}`,
        row: r,
        col: c,
        threshold,
      });
    }
  }

  return dots;
}

const DEFAULT_COLS = 12;
const DEFAULT_ROWS = 3;

export function TitlePixelTransition({
  start = 0.86,
  end = 0.94,
  durationMs = 1500,
  initialTitle = 'About Me',
  initialSubtitle = 'Architecting resilient full-stack systems, 3D graphics engines, and intelligent web agents.',
  flippedTitle = 'Education',
  flippedSubtitle = 'Academic Foundations & Industry Certifications',
  className,
  testId = 'title-pixel-transition',
  progress: explicitProgress,
}: TitlePixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dotElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const titleElRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleElRef = useRef<HTMLParagraphElement | null>(null);

  const phaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasActiveRef = useRef(false);
  const scrollTriggeredRef = useRef(false);
  const reverseRequestedRef = useRef(false);
  const lastSeqRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animFrameRef = useRef(0);
  const reducedMotion = getPrefersReducedMotion();

  const [cols] = useState(DEFAULT_COLS);
  const [rows] = useState(DEFAULT_ROWS);
  const [dots] = useState<PixelDotData[]>(() => generateDots(DEFAULT_COLS, DEFAULT_ROWS));

  // Contrasting text color (pure white on contrary emerald green in both light and dark modes)
  const resolvedDotColor = '#ffffff';

  const checkIsGreenBg = useCallback((seq: number): boolean => {
    if (typeof document === 'undefined') return false;
    const aboutSection = document.getElementById('about');
    if (aboutSection?.getAttribute('data-bg-transition') === 'true') return true;
    if (aboutSection?.getAttribute('data-bg-active') === 'true') return true;
    if (aboutSection?.getAttribute('data-bg-settled') === 'true') return true;
    if (document.documentElement.getAttribute('data-navbar-contrary') === 'true') return true;
    // Background pixel transition starts at 0.78 and completes at 0.86; covers title zone by ~0.82
    return seq >= 0.82;
  }, []);

  const renderPhase = useCallback(
    (p: number, isLightMode: boolean, isGreenBg: boolean) => {
      const textColor = isLightMode && !isGreenBg ? '#111827' : '#ffffff';
      const subColor = isLightMode && !isGreenBg ? '#374151' : 'rgba(255, 255, 255, 0.9)';

      if (titleElRef.current) {
        titleElRef.current.style.color = textColor;
      }
      if (subtitleElRef.current) {
        subtitleElRef.current.style.color = subColor;
      }

      const totalDots = dots.length;

      // Step 0: Initial state before pixel dissolve begins (p <= 0.02)
      if (p <= 0.02) {
        if (titleElRef.current) {
          if (titleElRef.current.textContent !== initialTitle) {
            titleElRef.current.textContent = initialTitle;
          }
          titleElRef.current.style.opacity = '1';
        }
        if (subtitleElRef.current) {
          if (subtitleElRef.current.textContent !== initialSubtitle) {
            subtitleElRef.current.textContent = initialSubtitle;
          }
          subtitleElRef.current.style.opacity = '0.9';
        }
        for (let i = 0; i < totalDots; i++) {
          const el = dotElementsRef.current[i];
          if (el && el.dataset.active !== 'false') el.dataset.active = 'false';
        }
        const aboutSection = typeof document !== 'undefined' ? document.getElementById('about') : null;
        if (aboutSection) {
          aboutSection.removeAttribute('data-title-settled');
          aboutSection.removeAttribute('data-title-active');
          aboutSection.removeAttribute('data-reverse-transition-active');
        }
        return;
      }

      const aboutSection = typeof document !== 'undefined' ? document.getElementById('about') : null;
      if (p < 0.98) {
        if (aboutSection) {
          aboutSection.removeAttribute('data-title-settled');
          if (wasActiveRef.current) {
            aboutSection.setAttribute('data-title-active', 'true');
            aboutSection.removeAttribute('data-reverse-transition-active');
          } else {
            aboutSection.setAttribute('data-reverse-transition-active', 'true');
            aboutSection.removeAttribute('data-title-active');
          }
        }
      }

      // Step 1: Phase 1 (0.02 to 0.45) - White pixel dots spawn with organic noise, covering & dissolving "About Me"
      if (p < 0.45) {
        const p1 = (p - 0.02) / 0.43; // 0 -> 1

        if (titleElRef.current) {
          if (titleElRef.current.textContent !== initialTitle) {
            titleElRef.current.textContent = initialTitle;
          }
          // Text dissolves as white pixel dots multiply over it
          titleElRef.current.style.opacity = Math.max(0, 1 - p1 * 1.8).toFixed(2);
        }

        if (subtitleElRef.current) {
          if (subtitleElRef.current.textContent !== initialSubtitle) {
            subtitleElRef.current.textContent = initialSubtitle;
          }
          subtitleElRef.current.style.opacity = Math.max(0, 0.9 - p1 * 2.0).toFixed(2);
        }

        // Activate white pixel dots with organic clustering
        for (let i = 0; i < totalDots; i++) {
          const el = dotElementsRef.current[i];
          const dot = dots[i];
          if (!el || !dot) continue;
          const isActive = p1 >= dot.threshold;
          const activeStr = String(isActive);
          if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
        }
        return;
      }

      // Step 2: Phase 2 (0.45 to 0.82) - "Education" starts being written / emerging within animated pixel dots
      if (p < 0.82) {
        const p2 = (p - 0.45) / 0.37; // 0 -> 1

        if (titleElRef.current) {
          // Character by character emergence inside pixel field: E -> Ed -> Edu -> ... -> Education
          const numChars = Math.max(
            1,
            Math.min(flippedTitle.length, Math.ceil(p2 * flippedTitle.length))
          );
          const written = flippedTitle.slice(0, numChars);
          if (titleElRef.current.textContent !== written) {
            titleElRef.current.textContent = written;
          }
          titleElRef.current.style.opacity = Math.min(1, 0.6 + p2 * 0.4).toFixed(2);
        }

        if (subtitleElRef.current) {
          if (subtitleElRef.current.textContent !== flippedSubtitle) {
            subtitleElRef.current.textContent = flippedSubtitle;
          }
          subtitleElRef.current.style.opacity = Math.min(0.9, p2 * 1.2).toFixed(2);
        }

        // Keep pixel dots animated across the writing phase
        for (let i = 0; i < totalDots; i++) {
          const el = dotElementsRef.current[i];
          const dot = dots[i];
          if (!el || !dot) continue;
          // Dots remain active to form the energetic pixel field around typing letters
          const isActive = dot.threshold >= p2 * 0.4;
          const activeStr = String(isActive);
          if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
        }
        return;
      }

      // Step 3: Phase 3 (0.82 to 1.00) - Pixel dots clear away, leaving crisp clean title "Education"
      const p3 = Math.min(1, (p - 0.82) / 0.18); // 0 -> 1

      if (titleElRef.current) {
        if (titleElRef.current.textContent !== flippedTitle) {
          titleElRef.current.textContent = flippedTitle;
        }
        titleElRef.current.style.opacity = '1';
      }

      if (subtitleElRef.current) {
        if (subtitleElRef.current.textContent !== flippedSubtitle) {
          subtitleElRef.current.textContent = flippedSubtitle;
        }
        subtitleElRef.current.style.opacity = '0.95';
      }

      // Pixel dots clear away left-to-right
      for (let i = 0; i < totalDots; i++) {
        const el = dotElementsRef.current[i];
        const dot = dots[i];
        if (!el || !dot) continue;
        const isActive = p3 < 0.98 && p3 < dot.threshold;
        const activeStr = String(isActive);
        if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
      }

      if (p >= 0.98) {
        if (aboutSection && aboutSection.getAttribute('data-title-settled') !== 'true') {
          aboutSection.setAttribute('data-title-settled', 'true');
          aboutSection.removeAttribute('data-title-active');
          aboutSection.removeAttribute('data-reverse-transition-active');
          window.dispatchEvent(new Event('scroll'));
        }
      }
    },
    [dots, flippedSubtitle, flippedTitle, initialSubtitle, initialTitle]
  );

  const step = useCallback(
    (now: number) => {
      animFrameRef.current = 0;
      const dt = lastFrameRef.current > 0 ? now - lastFrameRef.current : 16.7;
      lastFrameRef.current = now;

      phaseRef.current = advancePhase(
        phaseRef.current,
        wasActiveRef.current,
        dt,
        durationMs
      );

      const isLightMode =
        typeof document !== 'undefined' &&
        document.documentElement.dataset.theme === 'light';
      const isGreenBg =
        checkIsGreenBg(lastSeqRef.current) ||
        wasActiveRef.current ||
        phaseRef.current.t > 0;

      renderPhase(phaseRef.current.t, isLightMode, isGreenBg);

      if (!isPhaseAtTarget(phaseRef.current, wasActiveRef.current)) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        lastFrameRef.current = 0;
        endAnimation('about-title-pixel');
        const aboutSection = typeof document !== 'undefined' ? document.getElementById('about') : null;
        if (wasActiveRef.current) {
          aboutSection?.setAttribute('data-title-settled', 'true');
          aboutSection?.removeAttribute('data-title-active');
          aboutSection?.removeAttribute('data-reverse-transition-active');
          window.dispatchEvent(new Event('scroll'));
        } else {
          reverseRequestedRef.current = false;
          scrollTriggeredRef.current = false;
          aboutSection?.removeAttribute('data-reverse-transition-active');
          aboutSection?.removeAttribute('data-title-settled');
          aboutSection?.removeAttribute('data-title-active');
          window.dispatchEvent(new Event('scroll'));
        }
      }
    },
    [checkIsGreenBg, durationMs, renderPhase]
  );

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read sequence progress from container, closest overlay, active overlay in DOM, or computed style
    let rawSeq = container.style.getPropertyValue('--seq').trim();
    if (!rawSeq) {
      const overlay = container.closest<HTMLElement>('[data-active]');
      if (overlay) rawSeq = overlay.style.getPropertyValue('--seq').trim();
    }
    if (!rawSeq && typeof document !== 'undefined') {
      const activeOverlay =
        document.querySelector<HTMLElement>('[data-testid*="sequence-overlay"][data-active="true"]') ||
        document.querySelector<HTMLElement>('[data-active="true"][style*="--seq"]');
      if (activeOverlay) rawSeq = activeOverlay.style.getPropertyValue('--seq').trim();
    }
    if (!rawSeq) {
      const computed = getComputedStyle(container);
      rawSeq = computed.getPropertyValue('--seq').trim();
    }
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;
    lastSeqRef.current = seq;

    const isLightMode =
      typeof document !== 'undefined' &&
      document.documentElement.dataset.theme === 'light';
    const isGreenBg = checkIsGreenBg(seq);

    // 1. Explicit test override prop
    if (explicitProgress !== undefined) {
      renderPhase(explicitProgress, isLightMode, isGreenBg);
      return;
    }

    // 2. Reduced motion: immediate swap without timed phase
    if (reducedMotion) {
      const isPast = seq >= start;
      renderPhase(isPast ? 1 : 0, isLightMode, isGreenBg);
      return;
    }

    // 3. Fallback for testing environments where durationMs is 0 or unit tests
    if (durationMs === 0 || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      const span = Math.max(0.01, end - start);
      const p = Math.min(1, Math.max(0, (seq - start) / span));
      renderPhase(p, isLightMode, isGreenBg);
      return;
    }

    // 4. Boundary safety override for returning to the very start of the section:
    if (seq <= 0.05) {
      wasActiveRef.current = false;
      reverseRequestedRef.current = false;
      scrollTriggeredRef.current = false;
      if (phaseRef.current.t <= 0.005) {
        phaseRef.current = PHASE_AT_REST;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
        renderPhase(0, isLightMode, isGreenBg);
        return;
      }
    }

    // 6. Discrete scroll gating:
    // In production/browser, forward title dissolve requires that:
    // a) The background transition has settled green (data-bg-settled="true")
    // b) A separate, distinct user scroll down intent occurred after settling
    const aboutSection = typeof document !== 'undefined' ? document.getElementById('about') : null;
    const isBgSettled = aboutSection?.getAttribute('data-bg-settled') === 'true';
    const isEducationActive =
      aboutSection?.getAttribute('data-education-active') === 'true' ||
      (typeof document !== 'undefined' && document.querySelector('[data-open="true"]') !== null);

    const isTestEnv =
      durationMs === 0 ||
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
      explicitProgress !== undefined;

    const canActivateForward = isTestEnv || (isBgSettled && scrollTriggeredRef.current);
    const rawActive = phaseGate(seq, wasActiveRef.current, start, Math.max(0, start - 0.05));
    const shouldTriggerForward = canActivateForward && (seq >= (start - 0.09) || rawActive);

    const active = wasActiveRef.current
      ? (isEducationActive ? true : (!reverseRequestedRef.current && rawActive))
      : shouldTriggerForward;
    wasActiveRef.current = active;

    if (!isPhaseAtTarget(phaseRef.current, active) && animFrameRef.current === 0) {
      lastFrameRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      startAnimation('about-title-pixel');
      animFrameRef.current = requestAnimationFrame(step);
    } else if (animFrameRef.current === 0) {
      // Synchronize text colors/state with current theme and background state even when at rest
      renderPhase(phaseRef.current.t, isLightMode, isGreenBg);
    }
  }, [checkIsGreenBg, durationMs, end, explicitProgress, reducedMotion, renderPhase, start, step]);

  useEffect(() => {
    update();
    const unsubscribeScroll = subscribeScrollProgress(update);
    const unsubscribeIntent = subscribeScrollIntent((direction) => {
      const aboutEl = typeof document !== 'undefined' ? document.getElementById('about') : null;
      const bgSettled = aboutEl?.getAttribute('data-bg-settled') === 'true';
      const isEducationActive =
        aboutEl?.getAttribute('data-education-active') === 'true' ||
        (typeof document !== 'undefined' && document.querySelector('[data-open="true"]') !== null);

      if (direction === 'down') {
        reverseRequestedRef.current = false;
        if (bgSettled && !scrollTriggeredRef.current) {
          scrollTriggeredRef.current = true;
          update();
        }
      } else if (direction === 'up') {
        if (!isEducationActive && wasActiveRef.current) {
          reverseRequestedRef.current = true;
          update();
        }
      }
    });

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      unsubscribeScroll();
      unsubscribeIntent();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      endAnimation('about-title-pixel');
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      if (typeof document !== 'undefined') {
        const aboutSection = document.getElementById('about');
        aboutSection?.removeAttribute('data-title-settled');
        aboutSection?.removeAttribute('data-title-active');
        aboutSection?.removeAttribute('data-reverse-transition-active');
      }
    };
  }, [start, update]);

  return (
    <div
      ref={containerRef}
      className={`${styles.titleWrapper} ${className ?? ''}`}
      style={
        {
          ['--pixel-dot-color' as string]: resolvedDotColor,
          ['--dot-cols' as string]: cols,
          ['--dot-rows' as string]: rows,
        } as React.CSSProperties
      }
      data-testid={testId}
    >
      <div className={styles.titleBox}>
        <h2
          ref={titleElRef}
          className={styles.title}
          data-testid={`${testId}-heading`}
        >
          {initialTitle}
        </h2>

        {/* Contrasting pixel-dot grid strictly covering the title text box */}
        <div
          className={styles.pixelGrid}
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          data-testid={`${testId}-grid`}
          aria-hidden="true"
        >
          {dots.map((dot, idx) => (
            <span
              key={dot.id}
              ref={(el) => {
                dotElementsRef.current[idx] = el;
              }}
              className={styles.pixelDot}
              data-active="false"
              data-testid={`${testId}-dot`}
            />
          ))}
        </div>
      </div>

      <p
        ref={subtitleElRef}
        className={styles.subtitle}
        data-testid={`${testId}-subtitle`}
      >
        {initialSubtitle}
      </p>
    </div>
  );
}
