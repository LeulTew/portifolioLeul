import { useRef, useEffect, useCallback, type WheelEvent } from 'react';
import { PinnedSequence } from '../../ui/PinnedSequence';
import { STATEMENT_LAYERS, ABOUT_SCREENS } from './statementLayers';
import { StatementMorph } from './StatementMorph';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { EducationRail } from './EducationRail/EducationRail';
import { findScrollContainer, scrollContainerBy } from '@/lib/scroll/scrollContainer';
import styles from './About.module.css';
import { cvData } from '../../../data/cv';
import { projectsData } from '@/data/projects';
import { FocusScrim } from '../../ui/FocusScrim';
import { BackgroundPixelTransition } from './BackgroundPixelTransition';
import { TitlePixelTransition } from './TitlePixelTransition';
import { AboutHeading } from './AboutHeading';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import type { SectionNavigate } from '@/lib/scroll/sectionNavigation';
import { subscribeScrollGesture } from '@/lib/scroll/scrollGesture';
import { createAboutReader, createSeqReader } from './seqReader';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import {
  BEAT_DEADBAND,
  BEAT_REST_MS,
  STATEMENT_ARRIVE,
  STATEMENT_CLEAR,
  STATEMENT_CLEAR_SPAN,
  STATEMENT_SWAP,
  askBeat,
  beatRequested,
  beatWakeDelay,
  prepareBeatRequest,
  UNREQUESTED_BEAT,
  statementsHeldClear,
} from './aboutBeats';
import {
  advancePhase,
  easeInOutCubic,
  isPhaseAtTarget,
  phaseFrameDelta,
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
      <div className={`${styles.heldHeader} ${styles.heldHeaderWhite}`} data-heading-mirror="">
        <div className={styles.titleBox} data-heading-title="">
          <div
            className={`${styles.title} ${styles.titleWhite}`}
            data-testid="about-masked-title"
            data-text="About Me"
          />
        </div>
        <div
          className={`${styles.subtitle} ${styles.subtitleWhite}`}
          data-heading-subtitle=""
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
  const arrivePhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasArrivingRef = useRef(false);
  const clearPhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const wasClearingRef = useRef(false);
  const arriveRestRef = useRef(0);
  const arriveWaitingRef = useRef(false);
  const swapRequestRef = useRef(UNREQUESTED_BEAT);
  const clearRequestRef = useRef(UNREQUESTED_BEAT);
  const returnRequestRef = useRef(UNREQUESTED_BEAT);
  const unswapRequestRef = useRef(UNREQUESTED_BEAT);
  const leaveRequestRef = useRef(UNREQUESTED_BEAT);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRef = useRef<() => void>(() => {});
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

    // Position may be spent before any copy has arrived. Only the painted
    // background can choose the ink, or a flick leaves white copy on white.
    return false;
  }, [readAbout]);

  const renderPhase = useCallback(
    (t: number, clear: number, arrive: number) => {
      const el = ref.current;
      if (!el) return;

      const eased = easeInOutCubic(t);
      /*
       * Three factors, multiplied: arriving, handing over, and leaving.
       *
       * `arrive` is the statements' own entrance, and it is why they are no
       * longer on screen the moment the section is. The heading used to be
       * placed at its resting position from the first frame and the copy
       * ramped in three hundredths of the stretch later, so the name of the
       * section and its first statement introduced themselves together and
       * neither was read. Now the heading travels in alone, lands, and only
       * then is this allowed to start.
       */
      const arrived = easeInOutCubic(arrive);
      const present = (1 - clear) * arrive;
      const remainingOn = 1 - easeInOutCubic(clear);
      const presentOn = remainingOn * arrived;

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
      // Only readable rests accept selection; invisible copy must not catch the pointer.
      writeStyleProperty(el, '--one-copy-events', t === 0 && arrive === 1 && clear === 0 ? 'auto' : 'none');
      writeStyleProperty(el, '--two-copy-events', t === 1 && arrive === 1 && clear === 0 ? 'auto' : 'none');
      const seedOn = Math.max(arrived, Math.min(1, arriveRestRef.current / BEAT_REST_MS));
      writeStyleProperty(el, '--seed-on', seedOn.toFixed(3));
      writeStyleProperty(el, '--one-morph', arrived.toFixed(3));
      writeStyleProperty(el, '--two-morph', eased.toFixed(3));
      writeStyleProperty(el, '--one-shape-on', ((1 - eased) * remainingOn).toFixed(3));
      writeStyleProperty(el, '--two-shape-on', remainingOn.toFixed(3));
      writeAttribute(el, 'data-morphing', (arrive > 0 && arrive < 1) || (t > 0 && t < 1) ? 'true' : null);

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
       * Presence holds the heading through the complete reverse. Its existing
       * settled flag holds the pin during the rests on either side of the copy.
       */
      if (aboutEl) {
        const present = arrive > 0 || t > 0 || clear > 0 || wasArrivingRef.current;
        writeAttribute(aboutEl, 'data-statements-present', present ? 'true' : null);
      }
      if (clear >= 1) {
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

      if (arriveWaitingRef.current && arriveRestRef.current < BEAT_REST_MS) {
        arriveRestRef.current += phaseFrameDelta(dt);
        renderPhase(phaseRef.current.t, clearPhaseRef.current.t, arrivePhaseRef.current.t);
        if (arriveRestRef.current < BEAT_REST_MS) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          updateRef.current();
        }
        return;
      }
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
      arrivePhaseRef.current = advancePhase(
        arrivePhaseRef.current,
        wasArrivingRef.current,
        dt,
        STATEMENT_ARRIVE.durationMs
      );

      renderPhase(
        phaseRef.current.t,
        clearPhaseRef.current.t,
        arrivePhaseRef.current.t
      );

      // The same loop carries every statement phase and its matching shape.
      const running =
        !isPhaseAtTarget(phaseRef.current, wasActiveRef.current) ||
        !isPhaseAtTarget(clearPhaseRef.current, wasClearingRef.current) ||
        !isPhaseAtTarget(arrivePhaseRef.current, wasArrivingRef.current);

      if (running) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        lastFrameRef.current = 0;
        updateRef.current();
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
      const arrive = Math.min(
        1,
        Math.max(0, (seq - STATEMENT_ARRIVE.enter) / STATEMENT_CLEAR_SPAN)
      );
      renderPhase(t, clear, arrive);
      return;
    }

    const aboutEl = readAbout();
    const now = performance.now();
    const headSettled = aboutEl?.getAttribute('data-head-settled') === 'true';
    const backgroundBusy =
      aboutEl?.getAttribute('data-bg-active') === 'true' ||
      aboutEl?.getAttribute('data-bg-settled') === 'true';
    const arrive = arrivePhaseRef.current.t;
    const swap = phaseRef.current.t;
    const clear = clearPhaseRef.current.t;
    const spent = seq >= 0.995;
    const before = seq <= BEAT_DEADBAND;
    const arriveReached = phaseGate(seq, wasArrivingRef.current, STATEMENT_ARRIVE.enter, STATEMENT_ARRIVE.exit);
    const swapReached = phaseGate(seq, wasActiveRef.current, STATEMENT_SWAP.enter, STATEMENT_SWAP.exit);
    const clearReached = phaseGate(seq, wasClearingRef.current, STATEMENT_CLEAR.enter, STATEMENT_CLEAR.exit);

    if (!headSettled || !arriveReached) arriveRestRef.current = 0;
    arriveWaitingRef.current = headSettled && arriveReached && !wasArrivingRef.current;
    swapRequestRef.current = prepareBeatRequest(swapRequestRef.current, arrive >= 1 && swap < 1, now);
    clearRequestRef.current = prepareBeatRequest(clearRequestRef.current, swap >= 1 && clear < 1, now);
    returnRequestRef.current = prepareBeatRequest(returnRequestRef.current, !backgroundBusy && clear >= 1, now);
    unswapRequestRef.current = prepareBeatRequest(unswapRequestRef.current, clear <= 0 && !wasClearingRef.current && swap >= 1, now);
    leaveRequestRef.current = prepareBeatRequest(leaveRequestRef.current, swap <= 0 && !wasActiveRef.current && arrive >= 1, now);

    // Read completion, not threshold distance. Later beats hold earlier ones
    // through their reverse, including the stopped-reader pauses between them.
    wasClearingRef.current = backgroundBusy || (clearReached
      ? wasClearingRef.current || (swap >= 1 && beatRequested(clearRequestRef.current, spent, now))
      : (wasClearingRef.current && clear < 1) || statementsHeldClear({
        positionWants: false, backgroundBusy, wasClear: wasClearingRef.current,
        seq, armed: returnRequestRef.current.armed,
      }));
    const clearBusy = clear > 0 || wasClearingRef.current;
    wasActiveRef.current = clearBusy || (swapReached
      ? wasActiveRef.current || (arrive >= 1 && beatRequested(swapRequestRef.current, spent, now))
      : wasActiveRef.current && !beatRequested(unswapRequestRef.current, before, now));
    const swapBusy = swap > 0 || wasActiveRef.current;
    wasArrivingRef.current = swapBusy || (arriveReached
      ? wasArrivingRef.current || (headSettled && arriveRestRef.current >= BEAT_REST_MS)
      : wasArrivingRef.current && !beatRequested(leaveRequestRef.current, before, now));

    const delay = beatWakeDelay([
      { request: swapRequestRef.current }, { request: clearRequestRef.current },
      { request: returnRequestRef.current, cooldown: 0 }, { request: unswapRequestRef.current },
      { request: leaveRequestRef.current },
    ], now);
    if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = delay === null ? null : setTimeout(() => {
      cooldownTimerRef.current = null;
      update();
    }, delay);

    const running =
      (arriveWaitingRef.current && arriveRestRef.current < BEAT_REST_MS) ||
      !isPhaseAtTarget(phaseRef.current, wasActiveRef.current) ||
      !isPhaseAtTarget(clearPhaseRef.current, wasClearingRef.current) ||
      !isPhaseAtTarget(arrivePhaseRef.current, wasArrivingRef.current);

    if (running && animFrameRef.current === 0) {
      lastFrameRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
      animFrameRef.current = requestAnimationFrame(step);
    } else if (animFrameRef.current === 0) {
      renderPhase(
        phaseRef.current.t,
        clearPhaseRef.current.t,
        arrivePhaseRef.current.t
      );
    }
  }, [readAbout, readSeq, reducedMotion, renderPhase, step]);

  useEffect(() => {
    updateRef.current = update;
    update();
    const unsubProgress = subscribeScrollProgress(update);
    const unsubNavigation = subscribeSectionNavigation((target, options) => {
      if (options?.source !== 'navbar') return;
      const past = target !== 'home' && target !== 'about';
      const phase: PhaseState = { t: past ? 1 : 0, heading: past ? 1 : -1 };
      phaseRef.current = phase;
      arrivePhaseRef.current = phase;
      clearPhaseRef.current = phase;
      wasActiveRef.current = past;
      wasArrivingRef.current = past;
      wasClearingRef.current = past;
      arriveRestRef.current = 0;
      arriveWaitingRef.current = false;
      swapRequestRef.current = UNREQUESTED_BEAT;
      clearRequestRef.current = UNREQUESTED_BEAT;
      returnRequestRef.current = UNREQUESTED_BEAT;
      unswapRequestRef.current = UNREQUESTED_BEAT;
      leaveRequestRef.current = UNREQUESTED_BEAT;
      if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
      lastFrameRef.current = 0;
      renderPhase(phase.t, phase.t, phase.t);
    });

    const unsubGesture = subscribeScrollGesture((direction) => {
      const now = performance.now();
      if (direction === 'down') {
        swapRequestRef.current = askBeat(swapRequestRef.current, now);
        clearRequestRef.current = askBeat(clearRequestRef.current, now);
      } else {
        returnRequestRef.current = askBeat(returnRequestRef.current, now, 0);
        unswapRequestRef.current = askBeat(unswapRequestRef.current, now);
        leaveRequestRef.current = askBeat(leaveRequestRef.current, now);
      }
      update();
    });

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
          attributeFilter: [
            'data-bg-transition',
            'data-bg-active',
            'data-bg-settled',
            'data-head-settled',
          ],
        });
      }
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-navbar-contrary', 'data-theme'],
      });
    }

    return () => {
      unsubProgress();
      unsubNavigation();
      unsubGesture();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      observer?.disconnect();
      if (cooldownTimerRef.current !== null) clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [readAbout, renderPhase, update]);

  const forwardCopyWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const scrollport = findScrollContainer(readAbout());
    if (!scrollport || scrollport.contains(event.currentTarget)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollport.clientHeight : 1;
    scrollContainerBy(scrollport, event.deltaY * unit);
  }, [readAbout]);

  return (
    <div ref={ref} className={styles.statements} data-contrary="false" onWheel={forwardCopyWheel}>
      {children}
    </div>
  );
}

export function About({ onNavigate }: { onNavigate?: SectionNavigate } = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const educationRef = useRef<HTMLDivElement>(null);

  /*
   * The rail used to publish the chapter's colour from an IntersectionObserver
   * here, and it had no business doing so.
   *
   * It set `data-bg-transition` and `data-navbar-contrary` the moment the
   * Education rail so much as touched the viewport -- attributes owned by
   * `BackgroundPixelTransition`, which decides them from the beat that actually
   * paints the green. Two authors for one flag is rule 1 at the level of the
   * DOM: they agree nowhere except by accident. Measured, the rail clipped the
   * viewport at `seq` 0.549 and set `data-bg-transition`; the background's own
   * frame loop took it straight back off 8ms later, because the rise had not
   * started and its precondition was not even set.
   *
   * Eight milliseconds is one frame, and that frame is not free. `checkIsGreen`
   * reads that flag to decide the statements' ink, `useFooterContrast` watches
   * it, and it sits on `#about`, which `body:has(...)` selectors watch -- so a
   * one-frame flicker is a document-wide restyle and a visible twitch in the
   * chapter's colour, a third of the way in, for no reason at all.
   *
   * Nothing replaces it. `data-education-active` is published by `EducationRail`
   * from its own state, the bar reads the live grid through `data-nav-contrast`,
   * and the footer reads it through `isChapterBehind`. Every consumer already
   * had a better source than this observer's guess.
   */


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
          occludesWorld
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
          <AboutHeading>
            <TitlePixelTransition
              start={0.86}
              end={0.94}
              initialTitle="About Me"
              initialSubtitle={cvData.about.subtitle}
              flippedTitle="Education"
              flippedSubtitle="Academic Foundations & Industry Certifications"
            />
          </AboutHeading>

          {/* Masked transition overlay: pure white text cutout over rising green transition background */}
          <TransitionMaskedOverlay />

          <StatementsContainer>
            <div
              className={`${styles.leftColumn} ${styles.layerOne}`}
              data-testid="about-left-column"
            >
              <StatementMorph side="left" />
              <div className={styles.statementCopy} data-statement-copy="">
                <h3 className={styles.statementText}>
                  <span className={`${styles.statementLine} ${styles.lineFirst} ${styles.statementHinge}`}>
                    KEEP IT SIMPLE
                  </span>{' '}
                  <span
                    className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight} ${styles.statementInk}`}
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
            </div>

            <div
              className={`${styles.rightColumn} ${styles.layerTwo}`}
              data-testid="about-right-column"
            >
              <StatementMorph side="right" />
              <div className={styles.statementCopy} data-statement-copy="">
                <h3 className={styles.statementText}>
                  <span className={`${styles.statementLine} ${styles.lineFirst}`}>
                    <span className={styles.leadWord}>SCALABLE</span>{' '}
                    <span className={styles.leadWord}>SYSTEMS</span>
                  </span>{' '}
                  <span
                    className={`${styles.statementLine} ${styles.lineSecond} ${styles.statementHighlight} ${styles.statementSupport}`}
                  >
                    CRAFTED TO EMPOWER
                  </span>
                </h3>

                <div className={styles.metricsList}>
                  <div className={styles.metricItem}>
                    <span className={styles.metricValue}>{projectsData.length}</span>
                    <span className={styles.metricLabel}>
                      Projects to Explore Across Web, Mobile, AI &amp; Graphics
                    </span>
                  </div>
                  <div className={styles.metricItem}>
                    <span className={styles.metricValue}>
                      {cvData.skills.reduce((total, category) => total + category.items.length, 0)}
                    </span>
                    <span className={styles.metricLabel}>
                      Skills Across {cvData.skills.length} Engineering &amp; Design Categories
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
                  {cvData.about.highlights.map(highlight => (
                    <span key={highlight} className={styles.editorialPill}>
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </StatementsContainer>


        </PinnedSequence>

        {/* Education Section */}
        <div ref={educationRef} className={styles.educationWrapper} data-green-bg="true">
          {/* Owns the Education heading too: the heading has to be held on
              screen with the frame, not scroll away above it. */}
          <EducationRail onNavigate={onNavigate} />
        </div>
      </div>
    </section>
  );
}