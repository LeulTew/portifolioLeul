import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import {
  advancePhase,
  isPhaseAtTarget,
  phaseFrameDelta,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { ThemeContext, type Theme } from '../theme/ThemeContext';
import { ABOUT_CHAPTER_BG } from './chapterBackground';
import { BACKGROUND_RISE, BEAT_DEADBAND, BEAT_REST_MS, BEAT_COOLDOWN_MS } from './aboutBeats';
import { generateCells, getGridConfig, type PixelCellData } from './pixelRise';
import { createAboutReader, createSeqReader } from './seqReader';
import styles from './BackgroundPixelTransition.module.css';

export interface BackgroundPixelTransitionProps {
  /** Sequence progress where transition starts. Default: 0.78 (after statement 2 has disappeared). */
  start?: number;
  /** Sequence progress where transition ends. Default: 1.0. */
  end?: number;
  /** Consistent animation duration in milliseconds. Default: 1200 */
  durationMs?: number;
  color?: string;
  className?: string;
  testId?: string;
  /** Explicit progress override for deterministic testing. */
  progress?: number;
}


export function BackgroundPixelTransition({
  start = BACKGROUND_RISE.enter,
  end = 1.0,
  durationMs = BACKGROUND_RISE.durationMs,
  color,
  className,
  testId = 'bg-pixel-transition',
  progress: explicitProgress,
}: BackgroundPixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const maskBackdropRef = useRef<SVGRectElement | null>(null);
  const cellElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const maskCellElementsRef = useRef<(SVGRectElement | null)[]>([]);
  const [cells, setCells] = useState<PixelCellData[]>([]);
  const [cols, setCols] = useState(10);
  const [rows, setRows] = useState(6);
  const reducedMotion = getPrefersReducedMotion();

  const phaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasActiveRef = useRef(false);
  const lastFrameRef = useRef(0);
  const animFrameRef = useRef(0);
  const restRef = useRef(0);
  const armedRef = useRef(false);
  const readyAtRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readSeq = useRef(createSeqReader(() => containerRef.current)).current;
  const readAbout = useRef(createAboutReader()).current;

  const themeContext = useContext(ThemeContext);
  const currentTheme: Theme =
    themeContext?.theme ??
    (typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark');

  const resolvedColor = color ?? ABOUT_CHAPTER_BG[currentTheme];

  const updateGrid = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { cols: c, rows: r } = getGridConfig(window.innerWidth, window.innerHeight);
    setCols(c);
    setRows(r);
    setCells(generateCells(c, r));
  }, []);

  useEffect(() => {
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, [updateGrid]);

  const renderPhase = useCallback(
    (p: number) => {
      const aboutSection = readAbout();

      if (p <= 0.005) {
        /*
         * The at-rest branch, and therefore the hot one.
         *
         * This runs on essentially every frame of the page -- the beat is at
         * rest for all of it except the second and a half it is climbing -- so
         * every write here has to be guarded or the section charges the whole
         * site for standing still. `removeAttribute` on an absent attribute is
         * already free; the two below were not.
         */
        if (backdropRef.current && backdropRef.current.dataset.active !== 'false') {
          backdropRef.current.dataset.active = 'false';
        }
        if (
          maskBackdropRef.current &&
          maskBackdropRef.current.getAttribute('opacity') !== '0'
        ) {
          maskBackdropRef.current.setAttribute('opacity', '0');
        }
        if (aboutSection) {
          aboutSection.removeAttribute('data-bg-transition');
          aboutSection.removeAttribute('data-bg-active');
          aboutSection.removeAttribute('data-bg-settled');
        }
        if (typeof document !== 'undefined') {
          document.documentElement.removeAttribute('data-navbar-contrary');
        }
        cellElementsRef.current.forEach((el) => {
          if (el && el.dataset.active !== 'false') {
            el.dataset.active = 'false';
          }
        });
        maskCellElementsRef.current.forEach((el) => {
          // Guarded like every other write in this component. This is the
          // at-rest branch, so it runs on essentially every frame of the page
          // -- and it was re-declaring `opacity="0"` on every rect in the
          // cutout mask each time, which re-applies the mask over the whole
          // overlay for a value that has not moved since the section mounted.
          if (el && el.getAttribute('opacity') !== '0') el.setAttribute('opacity', '0');
        });
        return;
      }

      if (reducedMotion) {
        if (backdropRef.current) {
          backdropRef.current.dataset.active = String(p > 0.1);
        }
        if (maskBackdropRef.current) {
          const opacity = p > 0.1 ? '1' : '0';
          if (maskBackdropRef.current.getAttribute('opacity') !== opacity) {
            maskBackdropRef.current.setAttribute('opacity', opacity);
          }
        }
        if (aboutSection) {
          if (p > 0.1) {
            aboutSection.setAttribute('data-bg-transition', 'true');
            document.documentElement.setAttribute('data-navbar-contrary', 'true');
          } else {
            aboutSection.removeAttribute('data-bg-transition');
            document.documentElement.removeAttribute('data-navbar-contrary');
          }
        }
        return;
      }

      /*
       * Two different moments, and they used to be one.
       *
       * The solid backdrop slides under the grid at 0.95, while the last few
       * cells are still arriving -- that is a visual convenience, so the screen
       * is already the chapter colour behind the stragglers rather than showing
       * scene through the gaps.
       *
       * `data-bg-settled` is not that. It is this beat telling the rest of the
       * section it has FINISHED, and the title beat now waits on it before it
       * may start. Publishing it at 0.95 handed the title the last 5% of the
       * climb -- the top row, the most visible part of a rise -- to overlap
       * with. It is published at the end, and only at the end.
       *
       * `data-bg-active` runs to the same end for the same reason: it is what
       * holds the pin open, and releasing it at 0.95 opened a window where
       * neither beat claimed to be running and the overlay could unpin
       * mid-climb.
       */
      const isBackdropActive = p >= 0.95;
      const isComplete = p >= 0.999;

      if (backdropRef.current) {
        // Guarded like everything else in this loop: assigning the value it
        // already holds still marks the element dirty, once a frame.
        const backdropState = String(isBackdropActive);
        if (backdropRef.current.dataset.active !== backdropState) {
          backdropRef.current.dataset.active = backdropState;
        }
      }
      if (maskBackdropRef.current) {
        const opacity = isBackdropActive ? '1' : '0';
        if (maskBackdropRef.current.getAttribute('opacity') !== opacity) {
          maskBackdropRef.current.setAttribute('opacity', opacity);
        }
      }
      if (aboutSection) {
        if (isBackdropActive) {
          if (aboutSection.getAttribute('data-bg-transition') !== 'true') {
            aboutSection.setAttribute('data-bg-transition', 'true');
            document.documentElement.setAttribute('data-navbar-contrary', 'true');
          }
        } else if (p < 0.80) {
          if (aboutSection.getAttribute('data-bg-transition') === 'true') {
            aboutSection.removeAttribute('data-bg-transition');
            document.documentElement.removeAttribute('data-navbar-contrary');
          }
        }

        /*
         * Reaching 1 is not the same as being done, and only `step` knows the
         * difference.
         *
         * There is a rest after the climb before this beat hands over, and it
         * is served inside the frame loop. So the loop owns both of these once
         * the climb is complete: it clears `data-bg-active` and publishes
         * `data-bg-settled` together, at the end of the rest.
         *
         * If this branch published `data-bg-settled` at 1 the rest would buy
         * nothing -- the title would start the instant the last cell landed.
         * And if it cleared `data-bg-active` at 1, the rest would fall in a gap
         * where no beat claimed to be running and the pin could release
         * mid-handover. Both stay exactly as the climb left them.
         */
        if (!isComplete) {
          if (aboutSection.hasAttribute('data-bg-settled')) {
            aboutSection.removeAttribute('data-bg-settled');
          }
          if (p > 0.005) {
            if (aboutSection.getAttribute('data-bg-active') !== 'true') {
              aboutSection.setAttribute('data-bg-active', 'true');
            }
          } else if (aboutSection.hasAttribute('data-bg-active')) {
            aboutSection.removeAttribute('data-bg-active');
          }
        }
      }

      // Update each cell's activation based on its bottom-up threshold
      const total = cells.length;
      for (let i = 0; i < total; i++) {
        const el = cellElementsRef.current[i];
        const maskEl = maskCellElementsRef.current[i];
        const cell = cells[i];
        const threshold = cell ? cell.threshold : 1;
        const isActive = p >= threshold;

        if (el) {
          if (isActive && el.dataset.active !== 'true') {
            el.dataset.active = 'true';
          } else if (!isActive && el.dataset.active !== 'false') {
            el.dataset.active = 'false';
          }
        }

        if (maskEl) {
          // Guarded like the cell above it. `setAttribute` on an SVG element
          // invalidates the mask whether or not the value differs, and the mask
          // is re-applied over the whole overlay when it does -- once per cell
          // per frame, for the length of the beat, for a value that changes
          // twice in the cell's entire life.
          const opacity = isActive ? '1' : '0';
          if (maskEl.getAttribute('opacity') !== opacity) {
            maskEl.setAttribute('opacity', opacity);
          }
        }
      }
    },
    [cells, readAbout, reducedMotion]
  );

  const step = useCallback(
    (now: number) => {
      animFrameRef.current = 0;
      const dt = phaseFrameDelta(lastFrameRef.current > 0 ? now - lastFrameRef.current : 16.7);
      lastFrameRef.current = now;
      const remainingRiseMs = (1 - phaseRef.current.t) * durationMs;

      phaseRef.current = advancePhase(
        phaseRef.current,
        wasActiveRef.current,
        dt,
        durationMs
      );

      renderPhase(phaseRef.current.t);

      if (!isPhaseAtTarget(phaseRef.current, wasActiveRef.current)) {
        restRef.current = 0;
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      const aboutSection = readAbout();

      if (!wasActiveRef.current) {
        lastFrameRef.current = 0;
        restRef.current = 0;
        aboutSection?.removeAttribute('data-bg-settled');
        return;
      }

      /*
       * Finished climbing, but not yet finished: the rest is served here, with
       * the frame loop still running, and only then does the beat announce
       * itself done to whatever is waiting on it.
       */
      restRef.current += Math.max(0, dt - remainingRiseMs);
      if (restRef.current < BEAT_REST_MS) {
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      lastFrameRef.current = 0;
      restRef.current = 0;
      if (aboutSection?.getAttribute('data-bg-settled') !== 'true') {
        aboutSection?.setAttribute('data-bg-settled', 'true');
      }
      if (aboutSection?.hasAttribute('data-bg-active')) {
        aboutSection.removeAttribute('data-bg-active');
      }
    },
    [durationMs, readAbout, renderPhase]
  );

  const update = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;

    const seq = readSeq();

    // 1. Explicit test override prop
    if (explicitProgress !== undefined) {
      renderPhase(explicitProgress);
      return;
    }

    // 2. Reduced motion: immediate swap without timed phase
    if (reducedMotion) {
      const isPast = seq >= start;
      renderPhase(isPast ? 1 : 0);
      return;
    }

    // 3. Fallback for testing environments where durationMs is 0 or unit tests
    if (durationMs === 0 || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
      const span = Math.max(0.01, end - start);
      const testP = Math.min(1, Math.max(0, (seq - start) / span));
      renderPhase(testP);
      return;
    }

    // 4. Boundary safety override for returning to the very start of the pin:
    if (seq <= 0.05) {
      wasActiveRef.current = false;
      if (phaseRef.current.t <= 0.005) {
        phaseRef.current = PHASE_AT_REST;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
        renderPhase(0);
        return;
      }
    }

    /*
     * 5. Where the beat stands is decided by position; how fast it plays is
     * decided by time.
     *
     * `phaseGate` is the whole trigger, and it is deliberately the *only*
     * trigger. This used to activate on a scroll gesture -- a sticky flag set
     * by the first wheel notch after the statements settled -- while still
     * asking `phaseGate` whether to *stay* active. The two disagree everywhere
     * except at the threshold, so the beat switched on from the gesture and off
     * from the position on alternating frames, forever, at whatever `seq` the
     * reader happened to be holding.
     *
     * That oscillation is what jammed the section. Each swing re-registered a
     * scroll block, so input was cancelled on every other frame and the reader
     * could never travel to the position the sustain condition wanted -- the
     * gate was the reason its own precondition could not be met. Position is
     * now the single source of truth, so entering and staying cannot contradict
     * each other, and no input is cancelled at all.
     *
     * The beat is still discrete and still fixed-duration: crossing `start`
     * buys the whole 1200ms climb at its authored speed no matter how hard the
     * wheel was spun, and `advancePhase` reverses it from wherever it got to.
     * The deadband -- exit five hundredths below enter -- is what keeps an
     * inertial wobble on the threshold from restarting it.
     */
    const reached = phaseGate(
      seq,
      wasActiveRef.current,
      start,
      Math.max(0, start - BEAT_DEADBAND)
    );

    /*
     * And statement two has to have finished leaving before this may begin.
     *
     * Position alone cannot order these two either. The statements clear from
     * 0.70 on their own 600ms clock and this is triggered at 0.78, which any
     * ordinary scroll crosses in a fraction of that -- so the green started
     * climbing underneath a statement that was still fading out.
     *
     * Same shape as the title's precondition on this beat: a completion flag,
     * not a scroll gesture and not a second position threshold, so there is
     * nothing here that can disagree with `phaseGate` frame to frame. While the
     * flag is set this reduces to the position gate alone.
     */
    const aboutEl = readAbout();
    const statementsCleared =
      aboutEl?.getAttribute('data-statements-cleared') === 'true';

    /*
     * And coming back up, this beat is held open until the title has finished
     * un-writing itself -- the mirror of the title waiting on this one.
     *
     * Position releases them in the wrong order on the way up: the title's
     * deadband is at 0.81 and this one's at 0.73, so a reader scrolling up
     * crosses 0.81 and 0.73 within a couple of notches and the green starts
     * retreating out from under a heading that is still mid-dissolve. Down, the
     * green lands and then the heading is rewritten; up, the heading has to be
     * un-written and only then does the green go.
     */
    const titleBusy =
      aboutEl?.getAttribute('data-title-active') === 'true' ||
      aboutEl?.getAttribute('data-title-settled') === 'true' ||
      aboutEl?.getAttribute('data-reverse-transition-active') === 'true';


    /*
     * And the reader has to ask for it.
     *
     * Statement two takes 600ms to leave. By the time it has gone the reader has
     * usually crossed 0.78 already, so gating on position and on the clear
     * alone made the wall start itself the instant the copy was off screen.
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

    /*
     * Gestures made during the beat, and during the pause after it, count for
     * nothing.
     *
     * Requiring the previous beat to be finished is not enough on its own. A
     * reader spamming the wheel is still producing gestures at the exact moment
     * the flag lands, so the first one arms the next beat instantly and the
     * chain runs straight through as one movement -- the thing the arming was
     * added to prevent. `readyAtRef` is stamped when the precondition arrives,
     * and nothing is accepted until the rest has been served.
     */
    if (!statementsCleared) {
      armedRef.current = false;
      readyAtRef.current = 0;
      if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    } else if (readyAtRef.current === 0) {
      readyAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : 0;
    }
    const rested =
      readyAtRef.current > 0 &&
      (typeof performance !== 'undefined' ? performance.now() : 0) -
        readyAtRef.current >=
        BEAT_COOLDOWN_MS;
    if (readyAtRef.current > 0 && !rested && cooldownTimerRef.current === null) {
      cooldownTimerRef.current = setTimeout(() => {
        cooldownTimerRef.current = null;
        update();
      }, Math.max(1, BEAT_COOLDOWN_MS - (performance.now() - readyAtRef.current)));
    }

    /*
     * Past the end of the stretch, the beat stops waiting to be asked.
     *
     * The gesture requirement is what makes the stages discrete for someone
     * reading: each movement is theirs to call for. It cannot apply to someone
     * who has already gone. A flick spends the whole spacer in well under the
     * first beat's duration, the wheel stops, and every later stage is left
     * armed-but-unasked forever -- so the chapter never finishes, and because
     * the pin is now held until it does, the reader would be stuck under an
     * overlay waiting for an input they have no reason to give.
     *
     * Reaching the end of the stretch IS the request. There is nothing further
     * to scroll for, so the remaining movements play themselves out in order,
     * each still at its own fixed speed, and the chapter closes.
     */
    const spent = seq >= 0.995;
    const active =
      (reached && statementsCleared && (armedRef.current || wasActiveRef.current || (spent && rested))) ||
      titleBusy;

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
      renderPhase(phaseRef.current.t);
    }
  }, [durationMs, end, explicitProgress, readAbout, readSeq, reducedMotion, renderPhase, start, step]);

  useEffect(() => {
    update();
    const unsubscribe = subscribeScrollProgress(update);

    const unsubscribeGesture = subscribeScrollGesture((direction) => {
      if (direction !== 'down') return;
      if (readAbout()?.getAttribute('data-statements-cleared') !== 'true') return;
      if (armedRef.current) return;
      // Discarded, not queued: a gesture that merely arrived early
      // must not take effect the instant the rest is over.
      const since =
        (typeof performance !== 'undefined' ? performance.now() : 0) -
        readyAtRef.current;
      if (readyAtRef.current === 0 || since < BEAT_COOLDOWN_MS) return;
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
     * The filter is what keeps this safe. This component writes `data-bg-active`, `data-bg-settled` and `data-bg-transition` onto
     * the same element; naming only data-statements-cleared -- which it reads and never writes
     * -- leaves nothing it writes inside its own watch, so there is no loop.
     */
    let gateObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      const aboutEl = readAbout();
      if (aboutEl) {
        gateObserver = new MutationObserver(update);
        gateObserver.observe(aboutEl, {
          attributes: true,
          attributeFilter: [
            'data-statements-cleared',
            'data-title-active',
            'data-title-settled',
            'data-reverse-transition-active',
          ],
        });
      }
    }


    return () => {
      unsubscribe();
      unsubscribeGesture();
      gateObserver?.disconnect();
      if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      if (typeof document !== 'undefined') {
        const aboutSection = document.getElementById('about');
        aboutSection?.removeAttribute('data-bg-transition');
        aboutSection?.removeAttribute('data-bg-active');
        aboutSection?.removeAttribute('data-bg-settled');
        document.documentElement.removeAttribute('data-navbar-contrary');
      }
    };
  }, [readAbout, update]);

  return (
    <div
      ref={containerRef}
      className={`${styles.pixelContainer} ${className ?? ''}`}
      style={
        {
          ['--bg-transition-color' as string]: resolvedColor,
          ['--bg-cols' as string]: cols,
          ['--bg-rows' as string]: rows,
        } as React.CSSProperties
      }
      data-testid={testId}
      aria-hidden="true"
    >
      {/* SVG Mask Definition for razor-sharp pure white text cutout */}
      <svg className={styles.svgDef} aria-hidden="true" width="0" height="0">
        <defs>
          <mask id="bg-pixel-transition-mask" maskContentUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="1" fill="black" />
            <rect
              ref={maskBackdropRef}
              x="0"
              y="0"
              width="1"
              height="1"
              fill="white"
              opacity="0"
            />
            {cells.map((cell, idx) => (
              <rect
                key={cell.id}
                ref={(el) => {
                  maskCellElementsRef.current[idx] = el;
                }}
                x={cell.col / cols}
                y={cell.row / rows}
                width={1 / cols + 0.002}
                height={1 / rows + 0.002}
                fill="white"
                opacity="0"
              />
            ))}
          </mask>
        </defs>
      </svg>

      <div
        ref={backdropRef}
        className={styles.backdrop}
        data-active="false"
        data-testid={`${testId}-backdrop`}
      />

      <div className={styles.pixelGrid} data-testid={`${testId}-grid`}>
        {cells.map((cell, idx) => (
          <span
            key={cell.id}
            ref={(el) => {
              cellElementsRef.current[idx] = el;
            }}
            className={styles.pixelCell}
            data-active="false"
            data-testid={`${testId}-cell`}
          />
        ))}
      </div>
    </div>
  );
}
