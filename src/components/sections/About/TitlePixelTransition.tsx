import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { BEAT_DEADBAND, TITLE_WRITE } from './aboutBeats';
import { writeAttribute } from '@/lib/dom/cachedElement';
import {
  advancePhase,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { createAboutReader, createSeqReader } from './seqReader';
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
  start = TITLE_WRITE.enter,
  end = 0.94,
  durationMs = TITLE_WRITE.durationMs,
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
  const lastSeqRef = useRef(0);
  const lastFrameRef = useRef(0);
  const animFrameRef = useRef(0);
  const armedRef = useRef(false);
  const reducedMotion = getPrefersReducedMotion();

  const readSeq = useRef(createSeqReader(() => containerRef.current)).current;
  const readAbout = useRef(createAboutReader()).current;

  const [cols] = useState(DEFAULT_COLS);
  const [rows] = useState(DEFAULT_ROWS);
  const [dots] = useState<PixelDotData[]>(() => generateDots(DEFAULT_COLS, DEFAULT_ROWS));

  // Contrasting text color (pure white on contrary emerald green in both light and dark modes)
  const resolvedDotColor = '#ffffff';

  /**
   * Whether the heading is standing on green YET -- which is not the same as
   * the background having started.
   *
   * This decides the real heading's colour, and in light mode that is a jump
   * from near-black to white. It used to answer yes on `data-bg-active`, which
   * is set on the first frame of the rise while the wall is still a single row
   * along the bottom of the screen, and yes again on `seq >= 0.82` whether or
   * not anything had risen at all. Either way the heading went white a second
   * before the green got anywhere near it, standing white-on-pale in light
   * mode until the wall caught up.
   *
   * While the wall is climbing, the heading's own colour must not change at
   * all. `TransitionMaskedOverlay` is what makes it react: it lays a white copy
   * of the heading over the same pixel mask the rise is drawn from, so the
   * letters go white exactly where the green has reached and stay dark
   * everywhere else -- the edge cuts through mid-letter. That only reads
   * correctly if the heading underneath is still its normal colour.
   *
   * So this is true only once the green is actually everywhere:
   * `data-bg-transition` lands with the solid backdrop at 95%, and
   * `data-bg-settled` when the beat is done.
   */
  const checkIsGreenBg = useCallback((): boolean => {
    if (typeof document === 'undefined') return false;
    const aboutSection = readAbout();
    if (aboutSection?.getAttribute('data-bg-transition') === 'true') return true;
    if (aboutSection?.getAttribute('data-bg-settled') === 'true') return true;
    if (document.documentElement.getAttribute('data-navbar-contrary') === 'true') return true;
    return false;
  }, [readAbout]);

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
        const atRest = readAbout();
        if (atRest) {
          writeAttribute(atRest, 'data-title-settled', null);
          writeAttribute(atRest, 'data-title-active', null);
          writeAttribute(atRest, 'data-reverse-transition-active', null);
        }
        return;
      }

      const aboutSection = readAbout();
      if (p < 0.98 && aboutSection) {
        /*
         * Guarded, because this runs on every frame of the beat.
         *
         * `#about` is watched by `body:has(#about[data-...])` selectors, and an
         * attribute set to the value it already holds still marks the subtree
         * dirty and forces those to be re-evaluated against the document. Doing
         * that three times a frame for a second and a half, to write values
         * that changed once, is most of what this beat costs.
         */
        writeAttribute(aboutSection, 'data-title-settled', null);
        writeAttribute(aboutSection, 'data-title-active', wasActiveRef.current ? 'true' : null);
        writeAttribute(
          aboutSection,
          'data-reverse-transition-active',
          wasActiveRef.current ? null : 'true'
        );
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
          /*
           * From nothing, not from 0.6.
           *
           * Phase one leaves the heading at exactly 0 -- its ramp reaches zero
           * well before the phase ends -- so opening phase two at 0.6 was a
           * jump from invisible to more than half opaque in one frame, in both
           * directions. Scrolling down it flashed on; scrolling back up it
           * flashed off. Starting at p2 makes the two phases meet at the same
           * value, and phase three then continues from the 1 this ends at.
           */
          titleElRef.current.style.opacity = p2.toFixed(2);
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
        /*
         * Carries on clearing from where phase two left off.
         *
         * Phase two ends with exactly the dots above 0.4 still lit. This used
         * to restart from `p3 < threshold`, which at p3 = 0 lights every dot
         * above zero -- so every dot between 0 and 0.4 flicked back ON for one
         * frame at the boundary, a visible sparkle across the heading right as
         * it was supposed to be resolving. Sweeping the cut up from 0.4
         * continues the same motion instead.
         *
         * Past 1, not to 1: `generateDots` clamps with `Math.min(1, ...)`, so a
         * dot can sit at exactly 1.0 and a cut that stops there leaves it lit
         * forever -- a stray dot stranded on the finished heading. The sweep
         * therefore overshoots slightly and every dot is out a little before
         * the phase ends, which is invisible and correct.
         */
        const isActive = dot.threshold >= 0.4 + p3 * 0.65;
        const activeStr = String(isActive);
        if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
      }

      if (p >= 0.98) {
        if (aboutSection && aboutSection.getAttribute('data-title-settled') !== 'true') {
          aboutSection.setAttribute('data-title-settled', 'true');
          aboutSection.removeAttribute('data-title-active');
          aboutSection.removeAttribute('data-reverse-transition-active');
        }
      }
    },
    [dots, flippedSubtitle, flippedTitle, initialSubtitle, initialTitle, readAbout]
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
        checkIsGreenBg() ||
        wasActiveRef.current ||
        phaseRef.current.t > 0;

      renderPhase(phaseRef.current.t, isLightMode, isGreenBg);

      if (!isPhaseAtTarget(phaseRef.current, wasActiveRef.current)) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        lastFrameRef.current = 0;
        /*
         * The rail is told by the next frame, not by a synthetic event.
         *
         * This used to `dispatchEvent(new Event('scroll'))` here, which
         * synchronously re-entered all ten per-frame scroll subscribers from
         * inside this one's own rAF callback -- each of them reading rects and
         * writing styles, several of them writing the very attributes this
         * block had just set. EducationRail reads `data-title-settled` off the
         * scroll store every frame anyway, and cannot open until the reader has
         * scrolled the rail up to the fold regardless, so nothing needs waking.
         */
        const aboutSection = readAbout();
        if (wasActiveRef.current) {
          aboutSection?.setAttribute('data-title-settled', 'true');
          aboutSection?.removeAttribute('data-title-active');
          aboutSection?.removeAttribute('data-reverse-transition-active');
        } else {
          aboutSection?.removeAttribute('data-reverse-transition-active');
          aboutSection?.removeAttribute('data-title-settled');
          aboutSection?.removeAttribute('data-title-active');
        }
      }
    },
    [checkIsGreenBg, durationMs, readAbout, renderPhase]
  );

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const seq = readSeq();
    lastSeqRef.current = seq;

    const isLightMode =
      typeof document !== 'undefined' &&
      document.documentElement.dataset.theme === 'light';
    const isGreenBg = checkIsGreenBg();

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

    /*
     * 5. Position is the trigger; time is the pace. See the long note in
     * BackgroundPixelTransition for why -- this stage had the identical
     * contradiction, activating from a sticky scroll-gesture flag while asking
     * a position threshold whether to stay activated, and so flip-flopping
     * every frame with input cancelled on each swing.
     *
     * Crossing `start` still buys the whole 1500ms three-phase write of
     * "Education" at its authored speed, and it still reverses from wherever it
     * reached when the reader scrolls back up past the deadband.
     */
    const reached = phaseGate(
      seq,
      wasActiveRef.current,
      start,
      Math.max(0, start - BEAT_DEADBAND)
    );

    /*
     * And the background has to have finished before this may begin.
     *
     * Position alone cannot order these two. The background is triggered at
     * 0.78 and plays for a fixed two seconds; this is triggered at 0.86, which
     * is 0.08 of the pin away -- about 144px of scroll on a 900px screen. Any
     * ordinary scroll crosses that in a fraction of the background's duration,
     * so the heading began dissolving into "Education" with the green still
     * climbing behind it, and the two beats trod on each other.
     *
     * Widening the gap cannot fix that: no distance is safe, because the reader
     * chooses the speed. Blocking the scroll would fix it and is not allowed --
     * that is the whole reason this section used to trap the reader.
     *
     * So the *other* beat's completion is a precondition, read off the
     * attribute it already publishes when it settles. This cannot reintroduce
     * the flip-flop: `data-bg-settled` is not a scroll gesture and is not a
     * competing position threshold. It is written once when the background
     * reaches 1 and removed once when it reverses below its own deadband, and
     * while it is set this expression reduces to the position gate alone.
     *
     * A reader who flicks straight past 0.86 does not lose the beat -- the gate
     * stays satisfied by position, so the title plays the moment the background
     * reports itself done, at its own speed, exactly as if it had waited.
     */
    const isBackgroundSettled = readAbout()?.getAttribute('data-bg-settled') === 'true';

    /*
     * And the reader has to ask for it.
     *
     * The wall takes 1500ms to climb and the reader keeps scrolling while it does,
     * so 0.86 is almost always behind them by the time it lands. Gating on
     * position and on the background alone therefore rewrote the heading the
     * instant the last cell arrived, with no input in between -- the two beats
     * read as one long movement, which is exactly what they are not.
     *
     * `armed` is set by a scroll gesture, but ONLY one that happens after the
     * previous beat has finished -- which is what makes this a separate event
     * rather than the tail of the one before it. A single flick arms nothing,
     * because at the moment of the flick the beat before this had not
     * completed.
     *
     * This cannot bring back the flip-flop. The old bug was a gesture flag
     * deciding whether to ENTER while a position threshold decided whether to
     * STAY, so the two disagreed every frame and the beat swung forever. Here
     * the gesture only ever ANDs into the trigger, `phaseGate` still owns
     * entering and staying, and `armed` is monotonic for as long as the beat is
     * running. Once the beat reverses to rest it is cleared, so coming back
     * down asks again.
     */
    if (!isBackgroundSettled) armedRef.current = false;
    const active =
      reached && isBackgroundSettled && (armedRef.current || wasActiveRef.current);

    /*
     * Disarmed only on the way OUT, never merely for not having started.
     *
     * `armed` used to be cleared on any frame where the beat was not active,
     * which sounds equivalent and is not: the scroll is damped, so `seq` lags
     * the wheel by a few hundred milliseconds. The gesture would arm the beat,
     * the very next frame would find the position still short of the threshold,
     * and the arm was thrown away before the scroll it came from had arrived.
     * The reader then had to scroll, wait, and scroll again -- and the second
     * gesture usually landed while the position was still catching up too.
     *
     * A falling edge is the honest test: the beat WAS running and now is not,
     * which means the reader has left it behind and coming back should ask
     * again. Not yet started is not the same as finished with.
     */
    if (wasActiveRef.current && !active) armedRef.current = false;
    wasActiveRef.current = active;

    if (!isPhaseAtTarget(phaseRef.current, active) && animFrameRef.current === 0) {
      lastFrameRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      animFrameRef.current = requestAnimationFrame(step);
    } else if (animFrameRef.current === 0) {
      // Synchronize text colors/state with current theme and background state even when at rest
      renderPhase(phaseRef.current.t, isLightMode, isGreenBg);
    }
  }, [
    checkIsGreenBg,
    durationMs,
    end,
    explicitProgress,
    readAbout,
    readSeq,
    reducedMotion,
    renderPhase,
    start,
    step,
  ]);

  useEffect(() => {
    update();
    const unsubscribeScroll = subscribeScrollProgress(update);

    const unsubscribeGesture = subscribeScrollGesture((direction) => {
      if (direction !== 'down') return;
      if (readAbout()?.getAttribute('data-bg-settled') !== 'true') return;
      if (armedRef.current) return;
      armedRef.current = true;
      update();
    });

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    /*
     * Watches the one attribute this beat waits on.
     *
     * The precondition is published by another component when ITS beat
     * finishes, and that happens on a clock -- so it can land while the reader
     * is completely still. `update` is otherwise only driven by the scroll
     * store, which publishes nothing when nothing is moving, so a reader who
     * flicked past the whole section and stopped would sit there with the beat
     * released and never started, waiting for a scroll they have no reason to
     * make.
     *
     * The filter is what keeps this safe. This component writes `data-title-active`, `data-title-settled` and `data-reverse-transition-active` onto
     * the same element; naming only data-bg-settled -- which it reads and never writes
     * -- leaves nothing it writes inside its own watch, so there is no loop.
     */
    let gateObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      const aboutEl = readAbout();
      if (aboutEl) {
        gateObserver = new MutationObserver(update);
        gateObserver.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-settled'],
        });
      }
    }


    return () => {
      unsubscribeScroll();
      unsubscribeGesture();
      gateObserver?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
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
  }, [readAbout, start, update]);

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
