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

    const readSeq = createSeqReader(() => ref.current);

    const update = () => {
      // Masked cutout overlay is active while background pixels rise (seq >= 0.78)
      // Once solid green engages, CSS rule #about[data-bg-transition='true'] hides it cleanly
      const display = readSeq() >= 0.78 ? 'block' : 'none';
      // Assigning the same value still invalidates style for the subtree, and
      // this runs on every frame of the page, not just this stretch.
      if (el.style.display !== display) el.style.display = display;
    };

    update();
    const unsub = subscribeScrollProgress(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      unsub();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div ref={ref} className={styles.transitionMaskedOverlay} aria-hidden="true">
      <div className={styles.transitionGreenFill} />
      <div className={`${styles.heldHeader} ${styles.heldHeaderWhite}`}>
        <div className={styles.titleBox}>
          <div className={`${styles.title} ${styles.titleWhite}`} data-text="About Me" />
        </div>
        <div
          className={`${styles.subtitle} ${styles.subtitleWhite}`}
          data-text={cvData.about.subtitle}
        />
      </div>
    </div>
  );
}

interface StatementsContainerProps {
  children: React.ReactNode;
}

const DURATION_STATEMENT_SWAP = 800;

/**
 * Where the two statements hand over.
 *
 * Taken from `STATEMENT_LAYERS`: statement one ramps out across 0.38 to 0.46
 * while statement two ramps in over the same span, so 0.42 is the midpoint the
 * choreography is built around. The exit sits below the ramp so scrolling back
 * up genuinely leaves the beat rather than chattering on its own edge.
 */
const STATEMENT_SWAP_ENTER = 0.42;
const STATEMENT_SWAP_EXIT = 0.37;

function StatementsContainer({ children }: StatementsContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasActiveRef = useRef(false);
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
    (t: number) => {
      const el = ref.current;
      if (!el) return;

      const eased = easeInOutCubic(t);
      // Handover curves: zero empty gap.
      // As Statement One ramps out, Statement Two ramps in concurrently.
      el.style.setProperty('--one-in', (1 - t).toFixed(3));
      el.style.setProperty('--one-on', (1 - eased).toFixed(3));
      el.style.setProperty('--two-in', t.toFixed(3));
      el.style.setProperty('--two-on', eased.toFixed(3));

      const isGreen = checkIsGreen();
      if (isGreen) {
        if (el.dataset.contrary !== 'true') el.dataset.contrary = 'true';
      } else {
        if (el.dataset.contrary !== 'false') el.dataset.contrary = 'false';
      }

      const aboutEl = readAbout();
      if (t >= 0.999) {
        if (aboutEl?.getAttribute('data-statement-two-settled') !== 'true') {
          aboutEl?.setAttribute('data-statement-two-settled', 'true');
        }
      } else if (aboutEl?.hasAttribute('data-statement-two-settled')) {
        aboutEl.removeAttribute('data-statement-two-settled');
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
        DURATION_STATEMENT_SWAP
      );

      renderPhase(phaseRef.current.t);

      if (!isPhaseAtTarget(phaseRef.current, wasActiveRef.current)) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        lastFrameRef.current = 0;
        const aboutEl = readAbout();
        if (wasActiveRef.current) {
          aboutEl?.setAttribute('data-statement-two-settled', 'true');
        } else {
          aboutEl?.removeAttribute('data-statement-two-settled');
        }
      }
    },
    [readAbout, renderPhase]
  );

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const seq = readSeq();

    const isTestEnv =
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
      reducedMotion;

    if (isTestEnv) {
      // In test runner or reduced motion, directly map sequence progress:
      // Below 0.38: statement one (t = 0)
      // Above 0.46: statement two (t = 1)
      // Between 0.38 and 0.46: seamless handover
      const t = Math.min(1, Math.max(0, (seq - 0.38) / (0.46 - 0.38)));
      renderPhase(t);
      return;
    }

    // Returning to the start of the section:
    if (seq <= 0.05) {
      wasActiveRef.current = false;
      if (phaseRef.current.t > 0) {
        phaseRef.current = PHASE_AT_REST;
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
        renderPhase(0);
        return;
      }
    }

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
      STATEMENT_SWAP_ENTER,
      STATEMENT_SWAP_EXIT
    );

    if (!isPhaseAtTarget(phaseRef.current, wasActiveRef.current) && animFrameRef.current === 0) {
      lastFrameRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      animFrameRef.current = requestAnimationFrame(step);
    } else if (animFrameRef.current === 0) {
      renderPhase(phaseRef.current.t);
    }
  }, [checkIsGreen, readSeq, reducedMotion, renderPhase, step]);

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
     * and `update` itself writes `data-statement-two-settled` onto `#about`
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