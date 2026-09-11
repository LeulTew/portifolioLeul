import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { BEAT_DEADBAND, TITLE_WRITE, BEAT_COOLDOWN_MS } from './aboutBeats';
import { cachedElement, writeAttribute } from '@/lib/dom/cachedElement';
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
  const readyAtRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = getPrefersReducedMotion();

  const readSeq = useRef(createSeqReader(() => containerRef.current)).current;
  const readAbout = useRef(createAboutReader()).current;

  /*
   * The white half of the heading, which lives in the masked overlay.
   *
   * Resolved through the same cache as everything else here, so it is a lookup
   * once rather than per frame, and re-resolved only if the node is replaced.
   */
  const readMirrorTitle = useRef(
    cachedElement(() =>
      typeof document === 'undefined'
        ? null
        : document.querySelector<HTMLElement>('[data-testid="about-masked-title"]')
    )
  ).current;
  const readMirrorSubtitle = useRef(
    cachedElement(() =>
      typeof document === 'undefined'
        ? null
        : document.querySelector<HTMLElement>('[data-testid="about-masked-subtitle"]')
    )
  ).current;

  /**
   * Writes a line of the heading, and its mirror, from one call.
   *
   * The mirror is a second paint of the SAME words -- the only way to get two
   * colours out of one run of text split by a 2D boundary -- so every write
   * that reaches the real element has to reach it too. Routing both through
   * one function is what stops them drifting: there is no way to update one
   * and forget the other, which is how the copy ended up permanently reading
   * "About Me" while the real heading typed itself into "Education".
   */
  const paintLine = useCallback(
    (
      element: HTMLElement | null,
      mirror: HTMLElement | null,
      text: string,
      opacity: string
    ) => {
      if (element) {
        if (element.textContent !== text) element.textContent = text;
        if (element.style.opacity !== opacity) element.style.opacity = opacity;
      }
      if (mirror) {
        // The mirror renders through `content: attr(data-text)`.
        if (mirror.getAttribute('data-text') !== text) {
          mirror.setAttribute('data-text', text);
        }
        if (mirror.style.opacity !== opacity) mirror.style.opacity = opacity;
      }
    },
    []
  );

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
    /*
     * `data-bg-settled` alone, and the omissions matter as much as the term.
     *
     * `data-bg-transition` and `data-navbar-contrary` both land at 95%, with
     * the solid backdrop still fading up behind them for another 400ms -- and
     * the heading is at the top of the screen, the last place a wall climbing
     * from the bottom arrives. Taking the white on either of those put white
     * letters on a pale ground for the length of that fade, so the heading
     * disappeared in the beat before it was due to be rewritten.
     *
     * Until then the heading keeps its own colour and the masked mirror carries
     * the white exactly as far as the green has actually climbed.
     */
    return readAbout()?.getAttribute('data-bg-settled') === 'true';
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
      const aboutSection = readAbout();
      if (aboutSection) {
        const moving = p > 0 && p < 1;
        writeAttribute(aboutSection, 'data-title-settled', p >= 1 ? 'true' : null);
        writeAttribute(
          aboutSection,
          'data-title-active',
          moving && wasActiveRef.current ? 'true' : null
        );
        writeAttribute(
          aboutSection,
          'data-reverse-transition-active',
          moving && !wasActiveRef.current ? 'true' : null
        );
      }

      // Step 0: Initial state before pixel dissolve begins (p <= 0.02)
      if (p <= 0.02) {
        paintLine(titleElRef.current, readMirrorTitle(), initialTitle, '1');
        paintLine(
          subtitleElRef.current,
          readMirrorSubtitle(),
          initialSubtitle,
          '0.9'
        );
        for (let i = 0; i < totalDots; i++) {
          const el = dotElementsRef.current[i];
          if (el && el.dataset.active !== 'false') el.dataset.active = 'false';
        }
        return;
      }

      // Step 1: Phase 1 (0.02 to 0.45) - White pixel dots spawn with organic noise, covering & dissolving "About Me"
      if (p < 0.45) {
        const p1 = (p - 0.02) / 0.43; // 0 -> 1

        // Text dissolves as white pixel dots multiply over it.
        paintLine(
          titleElRef.current,
          readMirrorTitle(),
          initialTitle,
          Math.max(0, 1 - p1 * 1.8).toFixed(2)
        );
        paintLine(
          subtitleElRef.current,
          readMirrorSubtitle(),
          initialSubtitle,
          Math.max(0, 0.9 - p1 * 2.0).toFixed(2)
        );

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

        // Character by character emergence inside the pixel field:
        // E -> Ed -> Edu -> ... -> Education
        const numChars = Math.max(
          1,
          Math.min(flippedTitle.length, Math.ceil(p2 * flippedTitle.length))
        );
        paintLine(
          titleElRef.current,
          readMirrorTitle(),
          flippedTitle.slice(0, numChars),
          p2.toFixed(2)
        );
        paintLine(
          subtitleElRef.current,
          readMirrorSubtitle(),
          flippedSubtitle,
          Math.min(0.9, p2 * 1.2).toFixed(2)
        );

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

      paintLine(titleElRef.current, readMirrorTitle(), flippedTitle, '1');

      paintLine(
        subtitleElRef.current,
        readMirrorSubtitle(),
        flippedSubtitle,
        '0.95'
      );

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

    },
    [
      dots,
      flippedSubtitle,
      flippedTitle,
      initialSubtitle,
      initialTitle,
      paintLine,
      readAbout,
      readMirrorSubtitle,
      readMirrorTitle,
    ]
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
      }
    },
    [checkIsGreenBg, durationMs, renderPhase]
  );

  const update = useCallback((): void => {
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
    if (!isBackgroundSettled) {
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
      reached &&
      isBackgroundSettled &&
      (armedRef.current || wasActiveRef.current || (spent && rested));

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
