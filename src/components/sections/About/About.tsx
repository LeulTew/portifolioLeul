import { useRef, useEffect, useCallback } from 'react';
import { PinnedSequence } from '../../ui/PinnedSequence';
import { STATEMENT_LAYERS, ABOUT_SCREENS } from './statementLayers';
import { ParallaxPlate } from '../../ui/ParallaxPlate';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { EducationRail } from './EducationRail/EducationRail';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';
import { FocusScrim } from '../../ui/FocusScrim';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { TitlePixelTransition } from './TitlePixelTransition';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { createAboutReader, createSeqReader } from './seqReader';
import { writeStyleProperty } from '@/lib/dom/cachedElement';
import {
  STATEMENT_CLEAR,
  STATEMENT_CLEAR_SPAN,
  STATEMENT_SWAP,
} from './aboutBeats';
import {
  advancePhase,
  easeInOutCubic,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';

function TransitionMaskedOverlay() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const readAbout = createAboutReader();

    /*
     * This is the layer that lets the heading react to the green touching it.
     *
     * It holds a solid chapter-coloured fill and a pure white "About Me", and
     * the whole thing is clipped to `#bg-pixel-transition-mask` -- the same
     * cells the rise is drawn from. So wherever the wall has reached, you get
     * green with white lettering on it; everywhere else it is transparent and
     * the real heading shows through in its normal colour. The heading is cut
     * in half by the rising edge, mid-letter, and each part is legible against
     * what is actually behind it.
     *
     * It is switched on by the BEAT, not by the scroll position.
     *
     * It used to test `seq >= 0.78`, which is where the beat is *triggered* --
     * but the beat runs on its own clock from there, and on the way back up it
     * is still retreating long after the reader has taken `seq` below 0.78. The
     * cutout was being switched off with green still on screen, so the white
     * lettering vanished mid-retreat and the heading snapped back to dark over
     * a green background. `data-bg-active` is set for exactly as long as the
     * cells are moving, in both directions.
     */
    const update = () => {
      const running = readAbout()?.getAttribute('data-bg-active') === 'true';
      const display = running ? 'block' : 'none';
      // Assigning the same value still invalidates style for the subtree, and
      // this runs on every frame of the page, not just this stretch.
      if (el.style.display !== display) el.style.display = display;
    };

    update();
    const unsub = subscribeScrollProgress(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    // The beat starts and ends on a clock, which can happen with the reader
    // completely still and the scroll store publishing nothing.
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      const aboutEl = readAbout();
      if (aboutEl) {
        observer = new MutationObserver(update);
        observer.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-active'],
        });
      }
    }

    return () => {
      unsub();
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div ref={ref} className={styles.transitionMaskedOverlay} aria-hidden="true">
      <div className={styles.transitionGreenFill} />
      {/*
        * The white half of the heading, and it must never be its own heading.
        *
        * There is no way in CSS to paint one run of text in two colours split
        * by an arbitrary 2D boundary, so the two-tone effect needs a second
        * paint -- but the copy has to be a MIRROR, not a lookalike. This markup
        * used to carry a hardcoded "About Me", its own font rules and its own
        * drop shadow, so it drifted from the real heading in three ways at
        * once: it never followed the typing into "Education", it took an extra
        * `clip-path` reveal the real one does not have, and the shadow drew a
        * dark halo around white letters that read as a badly-registered second
        * copy -- which is exactly what it was.
        *
        * `TitlePixelTransition` now writes these two `data-text` values and
        * their opacity from the same code that writes the real heading, so
        * whatever the real one says, this says.
        */}
      <div className={`${styles.heldHeader} ${styles.heldHeaderWhite}`}>
        <div className={styles.titleBox}>
          <div
            className={`${styles.title} ${styles.titleWhite}`}
            data-testid="about-masked-title"
            data-text="About Me"
          />
        </div>
        <div
          className={`${styles.subtitle} ${styles.subtitleWhite}`}
          data-testid="about-masked-subtitle"
          data-text={cvData.about.subtitle}
        />
      </div>
    </div>
  );
}

interface StatementsContainerProps {
  children: React.ReactNode;
}

function StatementsContainer({ children }: StatementsContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasActiveRef = useRef(false);
  const clearPhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasClearingRef = useRef(false);
  const animFrameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const reducedMotion = getPrefersReducedMotion();

  const readSeq = useRef(createSeqReader(() => ref.current)).current;
  const readAbout = useRef(createAboutReader()).current;

  const checkIsGreen = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const aboutEl = readAbout();
    if (aboutEl?.getAttribute('data-bg-transition') === 'true') return true;
    if (aboutEl?.getAttribute('data-bg-active') === 'true') return true;
    if (aboutEl?.getAttribute('data-bg-settled') === 'true') return true;
    if (document.documentElement.getAttribute('data-navbar-contrary') === 'true') return true;

    return readSeq() >= 0.78;
  }, [readAbout, readSeq]);

  const renderPhase = useCallback(
    (t: number, clear: number) => {
      const el = ref.current;
      if (!el) return;

      const eased = easeInOutCubic(t);
      /*
       * Two beats, multiplied rather than sequenced.
       *
       * `t` is the handover and `clear` is the exit, and they are composed so
       * that whatever is on screen when the exit starts is what the exit takes
       * away. Writing the exit as a separate stage that overwrites the handover
       * would snap statement two back to full presence first if the reader
       * arrived at 0.70 with the swap still mid-flight.
       */
      const present = 1 - clear;
      const presentOn = 1 - easeInOutCubic(clear);

      /*
       * Handover curves: zero empty gap. As statement one ramps out, statement
       * two ramps in concurrently.
       *
       * Written only when the value actually moves, exactly as `PinnedSequence`
       * does it. `setProperty` invalidates style for the subtree whether or not
       * the value differs, and this runs from a scroll subscription that
       * publishes for the whole page -- so at rest, which is most of the time,
       * these four were re-declaring the same four numbers on every frame of
       * every section.
       */
      writeStyleProperty(el, '--one-in', ((1 - t) * present).toFixed(3));
      writeStyleProperty(el, '--one-on', ((1 - eased) * presentOn).toFixed(3));
      writeStyleProperty(el, '--two-in', (t * present).toFixed(3));
      writeStyleProperty(el, '--two-on', (eased * presentOn).toFixed(3));

      const isGreen = checkIsGreen();
      if (isGreen) {
        if (el.dataset.contrary !== 'true') el.dataset.contrary = 'true';
      } else {
        if (el.dataset.contrary !== 'false') el.dataset.contrary = 'false';
      }

      const aboutEl = readAbout();

      /*
       * The screen is empty, and the background is allowed to start.
       *
       * Published from the exit beat's own position rather than from the
       * scroll's, because the exit runs on a clock: a reader who arrives at
       * 0.78 fast is still watching statement two leave, and the background
       * rising underneath it is the two beats treading on each other.
       *
       * This is the only thing the section publishes about the statements.
       * There used to be a `data-statement-two-settled` alongside it, marking
       * the HANDOVER's completion -- written here and in `step`, on a hot path,
       * and by the end read by nothing at all: the pin extension that once
       * consumed it was corrected to ignore settled flags, and the background
       * waits on this one instead.
       */
      if (clear >= 0.999) {
        if (aboutEl?.getAttribute('data-statements-cleared') !== 'true') {
          aboutEl?.setAttribute('data-statements-cleared', 'true');
        }
      } else if (aboutEl?.hasAttribute('data-statements-cleared')) {
        aboutEl.removeAttribute('data-statements-cleared');
      }
    },
    [checkIsGreen, readAbout]
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
        STATEMENT_SWAP.durationMs
      );
      clearPhaseRef.current = advancePhase(
        clearPhaseRef.current,
        wasClearingRef.current,
        dt,
        STATEMENT_CLEAR.durationMs
      );

      renderPhase(phaseRef.current.t, clearPhaseRef.current.t);

      // One loop for both beats: a second `requestAnimationFrame` would run
      // the same composition twice per frame and publish it twice.
      const running =
        !isPhaseAtTarget(phaseRef.current, wasActiveRef.current) ||
        !isPhaseAtTarget(clearPhaseRef.current, wasClearingRef.current);

      if (running) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        lastFrameRef.current = 0;
      }
    },
    [renderPhase]
  );

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const seq = readSeq();

    const isTestEnv =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
      reducedMotion;

    if (isTestEnv) {
      /*
       * In the test runner and under reduced motion, both beats are read
       * straight off the position -- the same windows `STATEMENT_LAYERS`
       * declares, with no clock in between.
       *
       * Below 0.38: statement one. Between 0.38 and 0.46: the handover.
       * Between 0.70 and 0.78: statement two clears, so the background has an
       * empty screen to rise onto at 0.78.
       */
      const t = Math.min(1, Math.max(0, (seq - 0.38) / (0.46 - 0.38)));
      const clear = Math.min(
        1,
        Math.max(0, (seq - STATEMENT_CLEAR.enter) / STATEMENT_CLEAR_SPAN)
      );
      renderPhase(t, clear);
      return;
    }

    // Returning to the start of the section:
    if (seq <= 0.05) {
      wasActiveRef.current = false;
      wasClearingRef.current = false;
      if (phaseRef.current.t > 0 || clearPhaseRef.current.t > 0) {
        phaseRef.current = PHASE_AT_REST;
        clearPhaseRef.current = PHASE_AT_REST;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
        renderPhase(0, 0);
        return;
      }
    }

    const aboutEl = readAbout();

    // Check contrary background state
    const isGreen = checkIsGreen();
    if (isGreen) {
      if (el.dataset.contrary !== 'true') el.dataset.contrary = 'true';
    } else {
      if (el.dataset.contrary !== 'false') el.dataset.contrary = 'false';
    }

    /*
     * The handover is triggered by reaching it, and then plays on its own clock.
     *
     * This beat had no position gate at all: it was armed purely by a scroll
     * gesture anywhere inside the pin, which is why one notch at the very top
     * of the section could fire the swap before either statement had been read
     * -- and, because the two downstream stages keyed off the attribute it sets,
     * why the whole chain could arm itself hundreds of pixels early and then
     * fight the position thresholds it was handing over to.
     *
     * `advancePhase` still owns the pace, so the 800ms cross-fade cannot be
     * scrubbed or rushed, and reversing back up re-treads it from wherever it
     * got to.
     */
    wasActiveRef.current = phaseGate(
      seq,
      wasActiveRef.current,
      STATEMENT_SWAP.enter,
      STATEMENT_SWAP.exit
    );
    /*
     * Coming back up, the order has to be the way down played backwards.
     *
     * Position alone gives the opposite: this beat's threshold is at 0.70 and
     * the background's is at 0.78, so scrolling up releases THIS one first and
     * statement two walks back in over a screen that is still solid green,
     * while the wall is only starting to retreat behind it. Going down, the
     * statement leaves and then the green arrives; going up you would get both
     * at once.
     *
     * So the exit is held shut for as long as the background is anything other
     * than fully at rest. The green retreats first, uncovers the empty screen it
     * rose onto, and only then does statement two come back to it.
     */
    const backgroundBusy =
      aboutEl?.getAttribute('data-bg-active') === 'true' ||
      aboutEl?.getAttribute('data-bg-settled') === 'true';

    wasClearingRef.current =
      phaseGate(
        seq,
        wasClearingRef.current,
        STATEMENT_CLEAR.enter,
        STATEMENT_CLEAR.exit
      ) || backgroundBusy;

    const running =
      !isPhaseAtTarget(phaseRef.current, wasActiveRef.current) ||
      !isPhaseAtTarget(clearPhaseRef.current, wasClearingRef.current);

    if (running && animFrameRef.current === 0) {
      lastFrameRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      animFrameRef.current = requestAnimationFrame(step);
    } else if (animFrameRef.current === 0) {
      renderPhase(phaseRef.current.t, clearPhaseRef.current.t);
    }
  }, [checkIsGreen, readAbout, readSeq, reducedMotion, renderPhase, step]);

  useEffect(() => {
    update();
    const unsubProgress = subscribeScrollProgress(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    /*
     * Watches only what this component reads and never writes.
     *
     * The statements have to flip to white the moment the ground behind them
     * goes green, and that can happen with the reader completely still: the
     * background beat is time-driven, so it finishes on its own clock while
     * the scroll store -- which drops publishes below a 1e-4 delta -- has
     * nothing to say. Without a signal the copy stays dark on green until the
     * reader moves again.
     *
     * The filter is the whole point. This used to observe every attribute on
     * `#about` *and* on `documentElement`, with `update` as the callback --
     * and `update` itself writes `data-statements-cleared` onto `#about`
     * and `data-contrary` onto its own node. Every write scheduled the
     * observer, which ran `update`, which wrote again: a self-sustaining loop,
     * fed further by the two downstream stages writing their own `data-title-*`
     * and `data-bg-*` onto the same section. Naming exactly the attributes
     * this reads leaves nothing it writes inside its own watch.
     */
    const aboutEl = readAbout();
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(update);
      if (aboutEl) {
        observer.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-transition', 'data-bg-active', 'data-bg-settled'],
        });
      }
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-navbar-contrary', 'data-theme'],
      });
    }

    return () => {
      unsubProgress();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      observer?.disconnect();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [readAbout, update]);

  return (
    <div ref={ref} className={styles.statements} data-contrary="false">
      {children}
    </div>
  );
}

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const educationRef = useRef<HTMLDivElement>(null);
  const reducedMotion = getPrefersReducedMotion();

  useEffect(() => {
    const el = educationRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const aboutEl = document.getElementById('about');
        if (!aboutEl) return;
        if (entry.isIntersecting) {
          aboutEl.setAttribute('data-bg-transition', 'true');
          document.documentElement.setAttribute('data-navbar-contrary', 'true');
        } else {
          const rect = aboutEl.getBoundingClientRect();
          if (rect.bottom < 80 || rect.top > 80) {
            document.documentElement.removeAttribute('data-navbar-contrary');
          }
        }
      },
      { rootMargin: '-5% 0px -10% 0px' }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.removeAttribute('data-navbar-contrary');
      document.getElementById('about')?.removeAttribute('data-education-active');
    };
  }, []);

  /**
   * Symmetric, and driven by the scroll rather than played once on arrival.
   *
   * `whileInView` with `once: true` can only ever animate in: the columns
   * would sit at full opacity for the rest of the page no matter how far past
   * them the reader had scrolled. Reading presence per frame makes the exit
   * the entrance in reverse, for free.
   */
  return (
    <section ref={containerRef} className={styles.about} id="about">
      {/* Mostly copy, and long: close the world out entirely. */}
      <FocusScrim variant="solid" />
      <div className={styles.content}>
        <PinnedSequence
          screens={ABOUT_SCREENS}
          layers={STATEMENT_LAYERS}
          className={styles.aboutSequence}
          testId="about-sequence"
        >
          {/* Shuts the world out for exactly as long as the reader is held,
              and gives it back on the way out. Hosts the bottom-up background pixel transition. */}
          {/* `data-held-ground` rather than a class match: the footer contrast
              check looks this up per frame, and CSS-module class names are
              hashed, so it was reduced to a `[class*=]` substring scan over
              every element in the document. */}
          <div className={styles.heldGround} data-held-ground="true" aria-hidden="true">
            <BackgroundPixelTransition start={0.78} end={0.86} />
          </div>

          {/*
            Held with everything else rather than left in the flow. A heading
            above the pin travels with the page, so it climbs away while the
            reader is being held still underneath it -- the one thing naming
            the section leaves as the section begins. It stays for the whole
            stretch and flips horizontally left-to-right into Education once the
            background transition finishes fully.
          */}
          <div className={styles.heldHeader} data-testid="about-held-header">
            <TitlePixelTransition
              start={0.86}
              end={0.94}
              initialTitle="About Me"
              initialSubtitle={cvData.about.subtitle}
              flippedTitle="Education"
              flippedSubtitle="Academic Foundations & Industry Certifications"
            />
          </div>

          {/* Masked transition overlay: pure white text cutout over rising green transition background */}
          <TransitionMaskedOverlay />

          {/* Held for the whole stretch: the one thing that does not come and
              go, so the statements read as arriving on it. */}
          <div className={styles.heldField} aria-hidden="true">
            <ParallaxPlate reducedMotion={reducedMotion} />
            <ParallaxPlate flipped reducedMotion={reducedMotion} />
          </div>

          <StatementsContainer>
            <div
              className={`${styles.leftColumn} ${styles.layerOne}`}
              data-testid="about-left-column"
            >
              <h3 className={styles.statementText}>
                <span className={`${styles.statementLine} ${styles.lineFirst}`}>
                  KEEP IT SIMPLE
                </span>
                <span
                  className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight}`}
                >
                  BUT SIGNIFICANT
                </span>
              </h3>

              <div className={styles.subStatement}>
                <span className={styles.subStatementBar} />
                <span className={styles.subStatementText}>
                  CREATIVE ENGINEERING &amp; FULL-STACK SYSTEMS
                </span>
              </div>
            </div>

            <div
              className={`${styles.rightColumn} ${styles.layerTwo}`}
              data-testid="about-right-column"
            >
              <h3 className={styles.statementText}>
                <span className={`${styles.statementLine} ${styles.lineFirst}`}>
                  SCALABLE SYSTEMS
                </span>
                <span
                  className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight}`}
                >
                  CRAFTED TO EMPOWER
                </span>
              </h3>

              <div className={styles.metricsList}>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>3+</span>
                  <span className={styles.metricLabel}>
                    Years Engineering Production Web &amp; Mobile Systems
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>30+</span>
                  <span className={styles.metricLabel}>
                    Applications Delivered Across AI/ML, 3D &amp; Cloud
                  </span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>BSc</span>
                  <span className={styles.metricLabel}>
                    Computer Science Graduate (HiLCoE)
                  </span>
                </div>
              </div>

              <div className={styles.pillContainer}>
                {cvData.about.highlights.map((highlight, i) => (
                  <span key={i} className={styles.editorialPill}>
                    {highlight}
                  </span>
                ))}
              </div>
            </div>
          </StatementsContainer>


        </PinnedSequence>

        {/* Education Section */}
        <div ref={educationRef} className={styles.educationWrapper} data-green-bg="true">
          {/* Owns the Education heading too: the heading has to be held on
              screen with the frame, not scroll away above it. */}
          <EducationRail />
        </div>
      </div>
    </section>
  );
}