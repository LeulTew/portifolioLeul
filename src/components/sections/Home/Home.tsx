import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { KineticRotator } from '../../ui/KineticText';
import { ScrollCue, cueRunForHeight, cueRunOffset } from '../../ui/ScrollCue';
import { cueStartOffset } from '../../ui/ScrollCue/cueGeometry';
import { LiquidFillText } from '../../ui/LiquidFillText';
import styles from './Home.module.css';
import { cachedElement, writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { useSectionFocusEffect } from '@/lib/scroll/useSectionFocus';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { createTranslatedPositionReader } from '@/lib/scroll/translatedPosition';
import {
  HERO_SCREENS,
  CUE_START_GAP,
  CUE_TIP_GAP,
  advanceCue,
  cueDraw,
  cuePresence,
  cueRail,
  cueRest,
  holdProgress,
  pinOffset,
  INNER_EXIT_MS,
  INNER_ENTER,
  INNER_RELEASE,
} from '@/lib/motion/heroPin';
import {
  advancePhase,
  easeInOutCubic,
  isPhaseAtTarget,
  phaseGate,
  PHASE_AT_REST,
  type PhaseState,
} from '@/lib/motion/triggeredPhase';
import { getHeroCue, setHeroCue, subscribeHeroCue } from '@/lib/motion/heroCue';
import {
  HERO_SEQUENCE,
  SNOW_LEAD,
  cueDelay,
  cueDuration,
  innerExitCueAt,
  sequenceDuration,
} from '@/lib/motion/sectionChoreography';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { firstGlyphInkOffset, fontShorthand } from '@/lib/motion/glyphInk';
import { HeroAperture } from './HeroAperture';
import { HeroCloud } from './HeroCloud';
import { cloudBounds, measureHeroContent } from './heroContentBounds';
import { setAvatarHeroReady, useAvatarEncounterPresenting } from '@/lib/avatar/avatarEncounter';

/**
 * Rendered width of the cue, matching the stylesheet.
 *
 * The mark is drawn at a fixed aspect, so its width is what its length is
 * measured against; stated here because the run has to be computed from both.
 */
const CUE_WIDTH_PX = 112;

const findAbout = cachedElement(() => document.getElementById('about'));
const findCue = cachedElement(() => document.querySelector<HTMLElement>('[data-testid="scroll-cue"]'));
const CUE_OWNERS = ['data-head-pending', 'data-head-travelling', 'data-head-settled',
  'data-statements-present', 'data-bg-active', 'data-bg-settled', 'data-title-active',
  'data-title-settled', 'data-reverse-transition-active'];

/**
 * How long to wait for an entrance that never starts.
 *
 * Every entrance layer begins hidden and the animations are CSS, so a tab that
 * is served no frames gets no observer callback and would show an empty hero
 * for ever. Long enough that it can never cut a real sequence short.
 */
const NEVER_ENTERED_MS = 15000;

/**
 * Re-entry animation timing: faster and more fluid than the first load sequence,
 * starting immediately on arrival with rapid snow accumulation.
 */
const REENTRY_DURATION_MS = 1400;
const REENTRY_LEAD_MS = 280;

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
  /** Keep layout mounted beneath the loader without spending the visible entrance. */
  introReady?: boolean;
  /**
   * Renders the hero as an ordinary section, with no hold at all.
   *
   * There is nothing to hand over from when there is no world behind the copy
   * -- and nothing driving scroll progress either, since that comes from the
   * canvas's scroll controls. So the hero is one screen, the copy simply
   * stays, and the handover is a link rather than a performance.
   */
  flat?: boolean;
}

export function Home({ onNavigate, theme = 'light', flat = false, introReady = true }: HomeProps) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const introductionRef = useRef<HTMLDivElement | null>(null);
  const avatarActive = useAvatarEncounterPresenting();

  useLayoutEffect(() => {
    if (introductionRef.current) introductionRef.current.inert = avatarActive;
  }, [avatarActive]);

  const reducedMotion = usePrefersReducedMotion();

  /*
   * No hold means no extra height.
   *
   * Reduced motion already zeroed the hold but left the section two screens
   * tall, which is a screen of scroll spent going nowhere with the hero
   * standing still at the top of it -- the stuck page the hold was carefully
   * sized to avoid, arrived at by the opposite route.
   */
  const held = !flat && !reducedMotion;
  const screens = held ? HERO_SCREENS : 1;

  /*
   * Shared entry latch; departure is driven by the handover clock below.
   *
   * Only the entry latch comes back as a value. The exit is a transform, and
   * it is written straight to the element: as state it re-rendered the whole
   * hero -- the filling headline, the word rotator, both magnetic buttons --
   * on each of a hundred coverage steps, to move one translate.
   */
  // Only the arrival latch is needed from the observer now; the departure is
  // driven by the hold below, which is measured per frame.
  const hasEntered = useSectionFocusEffect(introReady ? sectionElement : null, () => {});

  /*
   * The handover's phases and their shared frame loop.
   *
   * Refs rather than state: these change every frame while a beat is running,
   * and re-rendering the hero -- the filling headline, the rotator, both
   * magnetic buttons -- to move one clip-path is the thing this whole file is
   * built to avoid.
   */
  const innerPhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const cuePhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const cueTargetRef = useRef(0);
  const cuePresentedRef = useRef(false);
  const [cuePresented, setCuePresented] = useState(false);
  const presentCue = useCallback((presented: boolean) => {
    if (cuePresentedRef.current === presented) return;
    cuePresentedRef.current = presented;
    setCuePresented(presented);
  }, []);
  const releaseCueFocus = useCallback(() => {
    document.querySelector<HTMLButtonElement>(
      'button[data-ink-control][aria-current="page"]:not([tabindex="-1"])',
    )?.focus({ preventScroll: true });
  }, []);
  const innerActiveRef = useRef(false);
  const frameRef = useRef(0);
  const applyRef = useRef<(() => void) | null>(null);
  const onCueDrawComplete = useCallback(() => applyRef.current?.(), []);
  const positionReaderRef = useRef<ReturnType<typeof createTranslatedPositionReader> | null>(null);
  const lastFrameRef = useRef(0);
  const settledRef = useRef(false);
  const [settled, setSettled] = useState(false);
  const cloudActiveRef = useRef(true);
  const [cloudActive, setCloudActive] = useState(true);
  const [reentryCount, setReentryCount] = useState(0);
  const [isReentering, setIsReentering] = useState(false);
  const [reentrySettled, setReentrySettled] = useState(false);

  useEffect(() => {
    setAvatarHeroReady(introReady && settled && (!isReentering || reentrySettled));
    return () => setAvatarHeroReady(false);
  }, [introReady, settled, isReentering, reentrySettled]);

  const firstLoadSettledRef = useRef(false);
  const hasLeftHomeRef = useRef(false);
  const isReenteringRef = useRef(false);
  const reentryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * The hold.
   *
   * One bounding rect per frame -- what a pin costs -- turned into three
   * things: how far to push the held block down so it appears to stand still,
   * how far through its departure the copy is, and how far the cue has been
   * drawn. All written straight to the DOM, so holding the hero still never
   * re-renders it.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!held) {
      innerPhaseRef.current = PHASE_AT_REST;
      cuePhaseRef.current = PHASE_AT_REST;
      innerActiveRef.current = false;
      cueTargetRef.current = 0;
      hasLeftHomeRef.current = false;
      if (isReenteringRef.current) {
        isReenteringRef.current = false;
        setIsReentering(false);
        setReentrySettled(true);
      }
    }
    let observedAbout: HTMLElement | null = null;
    let cueWasHeld = false;
    const styledCues = new Set<HTMLElement>();
    const chapterObserver = new MutationObserver(() => apply());
    let observedScrollLayer: HTMLElement | null = null;
    const findScrollLayer = cachedElement(() => {
      for (let node = sectionElement?.parentElement; node && node !== document.body; node = node.parentElement) {
        if (node.style.transform && node.style.transform !== 'none') return node;
      }
      return null;
    });
    const positionReader = sectionElement ? createTranslatedPositionReader(sectionElement, findScrollLayer) : null;
    positionReaderRef.current = positionReader;
    const scrollLayerObserver = new MutationObserver(() => {
      if (innerPhaseRef.current.t < 1 || findAbout()?.dataset.statementsPresent !== 'true') apply();
    });

    /*
     * One frame of the handover.
     *
     * The first frame after an idle stretch has no previous timestamp to
     * measure from, and a stale one would hand the beat a delta of however
     * long the reader sat still -- landing it instantly. `lastFrameRef` is
     * cleared whenever the loop stops, and a missing mark is treated as a
     * single ordinary frame.
     */
    const stepPhases = (now: number) => {
      const dt = lastFrameRef.current > 0 ? now - lastFrameRef.current : 16.7;
      lastFrameRef.current = now;
      innerPhaseRef.current = advancePhase(
        innerPhaseRef.current,
        innerActiveRef.current,
        dt,
        INNER_EXIT_MS
      );
      cuePhaseRef.current = advanceCue(cuePhaseRef.current, cueTargetRef.current, dt);
    };

    const frame = (now: number) => {
      frameRef.current = 0;
      stepPhases(now);
      /*
       * Republishing through `apply` is deliberate: it is the one place that
       * knows how to write every number, so a beat advancing by time and a
       * reader advancing by scroll go down exactly the same path.
       */
      apply();
    };

    /*
     * Runs the loop only while a beat still has somewhere to be, and stops it
     * the moment all have arrived. `apply` calls this on every scroll, so a
     * beat that is already finished costs one comparison rather than a frame.
     */
    const startPhaseLoop = () => {
      if (frameRef.current !== 0) return;
      if (
        isPhaseAtTarget(innerPhaseRef.current, innerActiveRef.current) &&
        cuePhaseRef.current.t === cueTargetRef.current
      ) {
        lastFrameRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(frame);
    };

    const apply = () => {
      const section = sectionElement;
      const pinned = pinRef.current;
      const content = contentRef.current;
      if (!section || !pinned) return;

      const holdLength = held ? window.innerHeight * (HERO_SCREENS - 1) : 0;

      const top = positionReader?.read() ?? section.getBoundingClientRect().top;
      const progress = holdProgress(top, holdLength);
      const about = findAbout();
      const scrollLayer = findScrollLayer();
      if (scrollLayer && scrollLayer !== observedScrollLayer) {
        scrollLayerObserver.disconnect();
        scrollLayerObserver.observe(scrollLayer, { attributes: true, attributeFilter: ['style'] });
        observedScrollLayer = scrollLayer;
      }
      if (about && about !== observedAbout) {
        chapterObserver.disconnect();
        chapterObserver.observe(about, { attributes: true, attributeFilter: CUE_OWNERS });
        observedAbout = about;
      }
      const chapterHoldsCue = held && getHeroCue() >= 1 &&
        CUE_OWNERS.some(name => about?.getAttribute(name) === 'true');
      if (chapterHoldsCue) cueWasHeld = true;
      if (cuePhaseRef.current.t <= 0) cueWasHeld = false;
      const heroStillLeaving = held && progress > INNER_ENTER &&
        innerPhaseRef.current.t < 1;
      const offset = `${Math.round(heroStillLeaving ? Math.max(-top, 0) : pinOffset(top, holdLength))}px`;
      if (pinned.style.getPropertyValue('--pin') !== offset) {
        pinned.style.setProperty('--pin', offset);
      }

      cueTargetRef.current = held ? (chapterHoldsCue ? 1 : cueDraw(top, holdLength, heldTopRef.current)) : 0;
      setHeroCue(!held ? 1 : cuePhaseRef.current.t);
      const cue = findCue();
      writeAttribute(
        section,
        'data-hero-handover-settled',
        !held || (getHeroCue() >= 1 && cue?.dataset.progress === '1.000' && !heroStillLeaving)
          ? 'true' : null
      );

      // The body-level portal needs viewport coordinates, including in reduced
      // motion. Its SVG progress alone cannot override a zero CSS opacity.
      const heldTop = heldTopRef.current;
      const rail = railRef.current;
      const scrolled = Math.max(-top, 0);
      const returningCue = cueWasHeld && !chapterHoldsCue && cueTargetRef.current < cuePhaseRef.current.t;
      const arrivingCue = held && !cueWasHeld && cuePhaseRef.current.t > 0 &&
        (cuePhaseRef.current.t < 1 || cue?.dataset.progress !== '1.000') &&
        cueTargetRef.current >= 1;
      const restingCue = chapterHoldsCue || returningCue || arrivingCue ||
        (heroStillLeaving && getHeroCue() >= 1);
      const y = restingCue ? rail.endY :
        rail.top - scrolled + cueRest(top, heldTop, window.innerHeight);
      const arrowX = returningCue ? rail.endX :
        rail.startX + (rail.endX - rail.startX) * easeInOutCubic(cuePhaseRef.current.t);

      const presence = !held || restingCue ? 1 : cuePresence(top, heldTop, window.innerHeight);
      const muted = about?.getAttribute('data-statements-present') === 'true';
      // The portal cannot inherit main's inertness. Its own painted rail,
      // including the static/reduced-motion rail, owns its availability.
      presentCue(!muted && Number(presence.toFixed(3)) > 0 && Number(getHeroCue().toFixed(3)) > 0 &&
        rail.height > 0 && y < window.innerHeight && y + rail.height > 0);
      if (cue) {
        styledCues.add(cue);
        writeStyleProperty(cue, '--cue-y', `${y.toFixed(3)}px`);
        writeStyleProperty(cue, '--cue-x', `${(!held ? rail.endX : arrowX).toFixed(3)}px`);
        writeStyleProperty(cue, '--cue-presence', presence.toFixed(3));
        writeStyleProperty(cue, '--cue-drawn', getHeroCue().toFixed(3));
        writeStyleProperty(cue, '--cue-chapter-opacity', muted ? '0' : '1');
        writeStyleProperty(cue, '--cue-animation-state', muted ? 'paused' : 'running');
        writeStyleProperty(cue, '--cue-heading-progress', held ? 'var(--head-travel, 0)' : '0');
      }

      if (!content) return;

      /*
       * Copy, fog and the requested stroke overlap on the same frame loop.
       * About still waits for both the foreground and the cue to finish.
       */
      /*
       * Scroll says *whether*, not *how far*.
       *
       * The foreground exit has one position trigger and runs on visible time.
       * Separate custom properties let the copy masks and the fog front paint
       * differently while still reaching their endpoints on the same frame.
       *
       * Flat and reduced-motion layouts have no hold. Their copy leaves by
       * native scrolling; only the cue's viewport position still needs updates.
       */
      let inner: number;
      let shut: number;

      if (!held) {
        inner = 0;
        shut = 0;
      } else {
        innerActiveRef.current = phaseGate(
          progress,
          innerActiveRef.current,
          INNER_ENTER,
          INNER_RELEASE
        ) || chapterHoldsCue || cuePhaseRef.current.t > 0;

        startPhaseLoop();

        inner = innerPhaseRef.current.t;
        shut = inner;
      }

      const cloudVisible = shut < 1;
      if (cloudVisible !== cloudActiveRef.current) {
        cloudActiveRef.current = cloudVisible;
        setCloudActive(cloudVisible);
      }

      /*
       * The exit cannot render until the entrance has handed over.
       *
       * Every rule that reads `--exit` and `--shut` is scoped to `.settled`,
       * because entrance keyframes and exit transforms cannot both own a
       * layer at once. That class is set by a timer running from the moment
       * the IntersectionObserver reports -- which on a first load, with the
       * loader just released and the scene still coming up, is seconds away.
       *
       * A reader who starts scrolling before then was writing both numbers
       * into a stylesheet that nothing was listening to: the hero simply rode
       * the pin, and then snapped to wherever the numbers had already reached
       * the instant the timer finally fired. That is the first-load glitch,
       * and it could only ever happen once, because on any later visit the
       * class is already on.
       *
       * Scrolling into the hold is the reader saying they are done with the
       * entrance, so it hands over there and then. Layers mid-entrance land on
       * their rest state, which is where they were heading anyway, and the
       * exit takes them from there.
       */
      if (introReady && !settledRef.current && (inner > 0 || shut > 0)) {
        settledRef.current = true;
        firstLoadSettledRef.current = true;
        setSettled(true);
      }

      /*
       * Headline re-entry snow choreography:
       * When the user leaves Home (after initial entrance is settled), we flag hasLeftHome.
       * When returning to Home on scroll up (or nav jump), we replay the snow effect
       * faster and more fluid without altering the first load sequence.
       */
      if (firstLoadSettledRef.current) {
        if (inner >= 0.6 || progress >= 0.35) {
          hasLeftHomeRef.current = true;
          if (isReenteringRef.current) {
            isReenteringRef.current = false;
            setIsReentering(false);
            setReentrySettled(true);
            if (reentryTimerRef.current) clearTimeout(reentryTimerRef.current);
          }
        } else if (
          held &&
          hasLeftHomeRef.current &&
          (progress <= 0.2 || !innerActiveRef.current)
        ) {
          hasLeftHomeRef.current = false;
          isReenteringRef.current = true;
          setIsReentering(true);
          setReentrySettled(false);
          setReentryCount((prev) => prev + 1);

          if (reentryTimerRef.current) clearTimeout(reentryTimerRef.current);
          reentryTimerRef.current = setTimeout(() => {
            setReentrySettled(true);
            setIsReentering(false);
            isReenteringRef.current = false;
          }, REENTRY_DURATION_MS + 50);
        }
      }

      const isVisible = shut < 1;

      if (!held) {
        // Clear the last held paint when a live preference/fallback releases it.
        writeStyleProperty(content, 'opacity', '1');
        writeStyleProperty(content, '--exit', '0.0000');
        writeStyleProperty(content, '--shut', '0.0000');
        writeAttribute(content, 'data-leaving', 'false');
      } else {
        /*
         * One number, and every layer reads its own departure out of it.
         *
         * The block used to carry the whole exit itself -- opacity, a rise, a
         * scale and a blur on the container -- which empties the hero as a
         * single sheet and re-rasterised the entire subtree every frame.
         */
        const value = inner.toFixed(4);
        if (content.style.getPropertyValue('--exit') !== value) {
          content.style.setProperty('--exit', value);
        }
        const shutValue = shut.toFixed(4);
        if (content.style.getPropertyValue('--shut') !== shutValue) {
          content.style.setProperty('--shut', shutValue);
        }

        /*
         * Flags the departure so the stylesheet can take the portrait's
         * backdrop-filter off for its duration. Written on the change, not
         * every frame: it is a state, not a value.
         */
        const leaving = inner > 0 ? 'true' : 'false';
        if (content.dataset.leaving !== leaving) content.dataset.leaving = leaving;
      }

      const pointerEvents = isVisible ? 'auto' : 'none';
      if (content.style.pointerEvents !== pointerEvents) {
        content.style.pointerEvents = pointerEvents;
      }
      const visibility = isVisible ? 'visible' : 'hidden';
      if (content.style.visibility !== visibility) content.style.visibility = visibility;
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    const unsubscribeNavigation = subscribeSectionNavigation((target, options) => {
      if (options?.source !== 'navbar') return;
      const leaving = held && target !== 'home';
      const phase: PhaseState = { t: leaving ? 1 : 0, heading: leaving ? 1 : -1 };
      innerPhaseRef.current = phase;
      cuePhaseRef.current = phase;
      innerActiveRef.current = leaving;
      cueTargetRef.current = phase.t;
      cueWasHeld = false;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      lastFrameRef.current = 0;
      setHeroCue(held ? phase.t : 1);
      if (sectionElement) writeAttribute(sectionElement, 'data-hero-handover-settled', !held || leaving ? 'true' : null);
    });
    applyRef.current = apply;
    window.addEventListener('resize', apply);
    window.addEventListener('scroll', apply, { passive: true });

    return () => {
      unsubscribe();
      unsubscribeNavigation();
      applyRef.current = null;
      positionReaderRef.current = null;
      chapterObserver.disconnect();
      scrollLayerObserver.disconnect();
      for (const cue of styledCues) {
        for (const property of ['--cue-x', '--cue-y', '--cue-drawn', '--cue-height',
          '--cue-presence', '--cue-chapter-opacity', '--cue-animation-state', '--cue-heading-progress']) {
          cue.style.removeProperty(property);
        }
      }
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply);
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      lastFrameRef.current = 0;
      if (reentryTimerRef.current) clearTimeout(reentryTimerRef.current);
    };
  }, [sectionElement, reducedMotion, held, introReady, presentCue]);

  /**
   * The rail the cue runs along, measured rather than declared.
   *
   * Its top is where the plate holding the copy ends and its bottom is just
   * above where About's heading will sit, so the mark is exactly as long as
   * the gap it bridges. Both are read from layout, because both move with the
   * window: a length written into the stylesheet would be wrong at every size
   * but one.
   */
  const [cueRun, setCueRun] = useState(0);
  const railRef = useRef({ top: 0, height: 0, startX: 0, endX: 0, startY: 0, endY: 0 });
  const heldTopRef = useRef(0);

  useEffect(() => {
    const section = sectionElement;
    if (!section || typeof window === 'undefined') return;

    /*
     * Returns false while the numbers are not trustworthy yet.
     *
     * About's heading is inside a pinned overlay that lays out after this
     * effect first runs, so its offset reads as `auto` on the first pass. That
     * used to fall through to a guess -- a share of the viewport -- and the
     * guess was never revisited, because nothing afterwards resized: the mark
     * ended up aimed eighty-five pixels above the words for the life of the
     * page. Better to have no rail for a few frames than a wrong one for good.
     */
    const measure = (): boolean => {
      positionReaderRef.current?.refresh();
      const about = document.getElementById('about');
      const plate = section.querySelector<HTMLElement>('[data-cue-layer="backdrop"]');
      const pinned = pinRef.current;
      const content = contentRef.current;
      if (!about || !plate || !pinned || !content) return false;
      const contentBounds = measureHeroContent(content);
      if (contentBounds) {
        const cloud = cloudBounds(contentBounds);
        writeStyleProperty(plate, '--cloud-left', `${cloud.left}px`);
        writeStyleProperty(plate, '--cloud-top', `${cloud.top}px`);
        writeStyleProperty(plate, '--cloud-width', `${cloud.width}px`);
        writeStyleProperty(plate, '--cloud-height', `${cloud.height}px`);
      }

      /*
       * Looked up on the document, not inside About.
       *
       * The held stretch is pinned through a portal -- the same reason About's
       * overlay can hold still inside a transformed scrollport -- so the
       * heading is not a descendant of the section it names. Scoping the query
       * to About found nothing, so the rail was never measured at all.
       */
      const heading = document.querySelector<HTMLElement>(
        '[data-testid="about-held-header"]'
      );
      if (!heading) return false;

      /*
       * Taken from the heading's resolved `top` rather than from a rect.
       *
       * It is pinned, so `top` IS its screen offset for the whole held
       * stretch -- and unlike a rect, it does not depend on where the scroll
       * happens to be when this runs.
       */
      const headingStyle = window.getComputedStyle(heading);

      const headingMotion = heading.style;
      const centerY = Number.parseFloat(headingMotion.getPropertyValue('--heading-origin-y'));
      const headingTop = held && Number.isFinite(centerY) ? centerY : Number.parseFloat(headingStyle.top);
      if (!Number.isFinite(headingTop) || headingTop <= 0) return false;

      /*
       * The mark stands on the vertical the heading's words start from.
       *
       * The heading spans the window and insets its text with a padding that
       * is a clamp against viewport width, so that vertical moves with the
       * size of the display. The mark was placed at a flat `15rem`, which
       * agreed with it at one window width and was visibly off at a 2K one.
       * Reading the heading's own inset is the only thing that lines up
       * everywhere -- and the line the reader sees is not at the centre of the
       * mark's box, so the box is shifted by where the run actually falls.
       */
      const headingLeft = Number.parseFloat(headingStyle.paddingLeft) || 0;

      /*
       * Plus the air built into the first letter.
       *
       * A display heading reads as aligned by the edge of its first letter,
       * and that is not the edge of its text box: the glyph carries a left
       * side bearing, and at this size it is worth a good many pixels. The
       * mark stood on the box, so it lined up with the subtitle underneath --
       * which shares the box -- and visibly not with the `A` it points at.
       *
       * Measured rather than written down, because there is no one answer.
       * The stylesheet asks for Inter and nothing in the app loads it, so the
       * face is whatever the reader has: Inter's `A` at weight 800 starts
       * exactly on the origin, and the platform fallback starts well inside
       * it. A constant would be right on one machine and wrong on the next.
       */
      const title = heading.querySelector('h2, h1') ?? heading;
      const inkOffset = firstGlyphInkOffset(
        title.textContent ?? '',
        fontShorthand(window.getComputedStyle(title))
      );
      const centerX = Number.parseFloat(headingMotion.getPropertyValue('--heading-origin-x'));
      const markLeft = held && Number.isFinite(centerX) ? centerX : headingLeft + inkOffset;

      /*
       * Where the held stretch begins, not where About's section does.
       *
       * About's heading lives in an overlay that is only drawn once the
       * stretch covers the window, and the stretch starts a quarter of a
       * screen inside the section. Aiming the mark at the section's own top
       * put its head off the window before the heading had appeared.
       */
      const spacer = about.querySelector<HTMLElement>('[data-testid="about-sequence"]');
      const heldTop =
        (spacer ? spacer.offsetTop + about.offsetTop : about.offsetTop) - section.offsetTop;
      heldTopRef.current = heldTop;

      /*
       * Measured against the pinned block, not via offsetTop.
       *
       * The plate's offsetParent is the copy it backs, so its offsetTop is an
       * offset within that -- it read -48 where the plate's bottom is actually
       * most of a screen down. Taking both rects and subtracting cancels the
       * pin as well, since the plate rides it: the answer is the same whether
       * the hold has pushed the block down or not.
       */
      const plateBottom = contentBounds
        ? content.getBoundingClientRect().top - pinned.getBoundingClientRect().top + contentBounds.bottom
        : plate.getBoundingClientRect().bottom - pinned.getBoundingClientRect().top;

      const holdLength = held ? window.innerHeight * (HERO_SCREENS - 1) : 0;
      const rail = cueRail(
        plateBottom,
        heldTop,
        headingTop,
        holdLength,
        window.innerHeight
      );
      if (rail.height <= 0) return false;

      const sourceLeft = contentBounds ? content.getBoundingClientRect().left + contentBounds.left : markLeft;
      const height = rail.height;
      railRef.current = {
        ...rail,
        height,
        startX: sourceLeft - cueStartOffset(CUE_WIDTH_PX),
        endX: markLeft - cueRunOffset(CUE_WIDTH_PX),
        startY: plateBottom + CUE_START_GAP,
        endY: headingTop - CUE_TIP_GAP - height,
      };
      writeStyleProperty(section, '--cue-top', `${rail.top.toFixed(3)}px`);
      writeStyleProperty(section, '--cue-height', `${height.toFixed(3)}px`);

      // The portaled mark reads its geometry from the root, for the same reason.
      const cue = findCue();
      if (cue) writeStyleProperty(cue, '--cue-height', `${height.toFixed(3)}px`);
      setCueRun(cueRunForHeight(height, CUE_WIDTH_PX));
      applyRef.current?.();
      return true;
    };

    /*
     * Retried until the overlay has laid out, then left alone. Bounded, so a
     * page whose heading never appears stops asking rather than polling for
     * the life of the session.
     */
    let retry: ReturnType<typeof setInterval> | undefined;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    const observerRef: { current: ResizeObserver | null } = { current: null };

    if (!measure()) {
      retry = setInterval(() => {
        if (!measure() || !retry) return;

        clearInterval(retry);
        retry = undefined;

        // It exists now, and it is the thing whose geometry the rail aims at.
        const heading = document.querySelector('[data-testid="about-held-header"]');
        if (heading) observerRef.current?.observe(heading);
      }, 120);
      giveUp = setTimeout(() => {
        if (retry) clearInterval(retry);
        retry = undefined;
      }, 4000);
    }

    window.addEventListener('resize', measure);
    window.addEventListener('about-heading-layout', measure);

    /*
     * And once more when the fonts have settled.
     *
     * The mark's inset now depends on the first letter's own side bearing,
     * which is a property of the face that actually renders. Measure it while
     * the page is still on a fallback and the answer belongs to a letter the
     * reader never sees. Every other trigger here watches for size changing,
     * and a face swapping for one of the same size moves the ink without
     * moving anything a ResizeObserver would report.
     */
    let dropped = false;
    document.fonts?.ready
      ?.then(() => {
        if (!dropped) measure();
      })
      .catch(() => {});

    /*
     * Observed, not just listened for.
     *
     * Both ends of the rail are clamps against viewport size -- the heading's
     * offset down the window, its inset from the left -- so every one of them
     * moves when the display does. A resize listener alone missed it: the mark
     * kept the vertical it had been given at the width the page happened to
     * load at, which is why it sat correctly on one monitor and visibly off on
     * a wider one.
     *
     * Everything the measurement actually reads is observed: the hero for its
     * own box, the root for the viewport, and the heading itself, which lives
     * in a portal and lays out after the rest.
     */
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());

    observerRef.current = observer;

    if (observer) {
      observer.observe(section);
      observer.observe(document.documentElement);

      const heading = document.querySelector('[data-testid="about-held-header"]');
      if (heading) observer.observe(heading);
    }

    return () => {
      dropped = true;
      if (retry) clearInterval(retry);
      if (giveUp) clearTimeout(giveUp);
      window.removeEventListener('resize', measure);
      window.removeEventListener('about-heading-layout', measure);
      observer?.disconnect();
    };
  }, [sectionElement, held]);

  /*
   * Guarantees the hero ends up visible, however the entrance goes.
   */
  useEffect(() => {
    if (!introReady) return;
    /*
     * Restarted when the entrance actually begins.
     *
     * This is the glitch on a hard refresh. The backstop was armed at mount,
     * but the entrance starts when the IntersectionObserver reports -- and on
     * a first load, with the loader just handed over and the scene coming up,
     * that callback can arrive a second or more late. The backstop then fired
     * while the sequence was still playing and `.settled` snapped every layer
     * to its finished state, which is exactly "it glitches and disappears".
     * On a later visit the class is already on, so there is nothing to snap
     * and it looks fine -- which is why it only ever went wrong the first time.
     *
     * Still armed when nothing has entered, because the layers start hidden
     * and CSS animations need frames: a tab served none would otherwise show
     * an empty hero for ever. That path just waits a good deal longer.
     */
    const settle = setTimeout(
      () => {
        setSettled(true);
        firstLoadSettledRef.current = true;
      },
      hasEntered ? (sequenceDuration(HERO_SEQUENCE) + 0.8) * 1000 : NEVER_ENTERED_MS
    );
    return () => clearTimeout(settle);
  }, [hasEntered, introReady]);

  /**
   * Puts a layer on its beats: when it arrives, and when it leaves.
   *
   * Both come from the cue list, so the order out is the order in, reversed,
   * without either being restated in the stylesheet.
   */
  const at = (id: string) => ({
    ['--cue-at' as string]: `${cueDelay(HERO_SEQUENCE, id)}s`,
    ['--exit-at' as string]: `${innerExitCueAt(HERO_SEQUENCE, id)}`,
  });

  const scrollToAbout = () => {
    if (onNavigate) {
      onNavigate('about');
      return;
    }
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('about')?.scrollIntoView({ 
      behavior: prefersReduced ? 'auto' : 'smooth', 
      block: 'start' 
    });
  };

  const scrollToContact = () => {
    if (onNavigate) {
      onNavigate('contact');
      return;
    }
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('contact')?.scrollIntoView({ 
      behavior: prefersReduced ? 'auto' : 'smooth', 
      block: 'start' 
    });
  };

  return (
    <section
      ref={setSectionElement}
      className={styles.home}
      id="home"
      style={{ ['--hero-screens' as string]: `${screens}` }}
    >
      {/*
        Held at the first screen of the section while the scroll advances the
        handover. One transform on one wrapper, so the aperture, the copy and
        the cue pin as a single composited layer and cannot drift apart.
      */}
      <div ref={pinRef} className={styles.pinned} data-testid="hero-pinned">
      {/* Opens the world from a slit on arrival. Behind the copy, in front of
          the canvas. The exit belongs to the plate, not to this. */}
      <HeroAperture />

      <div ref={introductionRef} className={styles.introductionStage}
        data-avatar-active={avatarActive || undefined} aria-hidden={avatarActive || undefined}>
      <div
        ref={contentRef}
        className={[
          styles.content,
          hasEntered ? styles.entered : '',
          settled ? styles.settled : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ opacity: 1 }}
        data-testid="hero-content"
      >
        {/* The wrapper owns arrival/dispersion; the cloud owns only its internal drift. */}
        <div
          className={`${styles.plate} ${hasEntered ? styles.plateDrawn : ''}`}
          style={at('backdrop')}
          aria-hidden="true"
          data-cue-layer="backdrop"
          data-cloud-active={cloudActive}
        >
          <HeroCloud active={cloudActive && !avatarActive} theme={theme} />
        </div>

        {/* Always present: it is the frame the sequenced layers arrive into. */}
        <div className={styles.header}>
          <div
            className={`${styles.imageContainer} ${styles.reveal} ${styles.revealPortrait}`}
            style={at('portrait')}
            data-cue-layer="portrait"
          >
            <div className={styles.imagePlaceholder}>
              <span className={styles.circleText}>L</span>
              <img 
                src="/images/leul-profile.webp" 
                alt="Leul" 
                className={styles.circleImage}
              />
            </div>
          </div>

          <h1
            className={`${styles.title} ${isReentering ? styles.titleReentering : ''}`}
            style={at('title')}
            data-cue-layer="title"
          >
            <LiquidFillText
              key={reentryCount > 0 ? `reentry-leul-${reentryCount}` : 'first-load-leul'}
              text="Leul"
              filling={hasEntered}
              settled={reentryCount > 0 ? reentrySettled : settled}
              delayMs={reentryCount > 0 ? 0 : cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={
                reentryCount > 0 ? REENTRY_DURATION_MS : cueDuration(HERO_SEQUENCE, 'title') * 1000
              }
              leadMs={reentryCount > 0 ? REENTRY_LEAD_MS : SNOW_LEAD * 1000}
              className="mr-3"
            />
            <LiquidFillText
              key={reentryCount > 0 ? `reentry-tewodros-${reentryCount}` : 'first-load-tewodros'}
              text="Tewodros"
              filling={hasEntered}
              settled={reentryCount > 0 ? reentrySettled : settled}
              delayMs={reentryCount > 0 ? 0 : cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={
                reentryCount > 0 ? REENTRY_DURATION_MS : cueDuration(HERO_SEQUENCE, 'title') * 1000
              }
              leadMs={reentryCount > 0 ? REENTRY_LEAD_MS : SNOW_LEAD * 1000}
              className={styles.lastname}
            />
          </h1>

          <div
            className={`${styles.info} ${styles.reveal} ${styles.revealLine}`}
            style={at('role')}
            data-cue-layer="role"
          >
            <span className="opacity-80">ARCHITECTING</span>
            <KineticRotator words={['FULL-STACK APPS', 'THREE.JS 3D EXPERIENCES', 'INTELLIGENT SYSTEMS', 'HIGH-PERFORMANCE UI']} />
          </div>
        </div>

        <p
          className={`${styles.description} ${styles.reveal} ${styles.revealLine}`}
          style={at('description')}
          data-cue-layer="description"
        >
          Software engineer building web and mobile tools, interactive 3D and applied AI.
        </p>

        {/* Magnetic CTA Buttons */}
        <div
          className={`flex flex-wrap items-center gap-4 mt-6 pointer-events-auto ${styles.reveal}`}
          style={at('actions')}
          data-cue-layer="actions"
        >
          <MagneticButton onClick={scrollToAbout} variant="primary" theme={theme}>
            Explore My Work
          </MagneticButton>
          <MagneticButton onClick={scrollToContact} variant="secondary" icon={false} theme={theme}>
            Get In Touch
          </MagneticButton>
        </div>
      </div>
      </div>

      <motion.div 
        className={styles.profileImage}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 1,
          ease: [0.76, 0, 0.24, 1],
          delay: 0.2
        }}
      >
        <img src="/images/leul-profile.webp" alt="Leul" />
      </motion.div>

      {/* Last cue: the affordance invites the next move, so it must not compete
          with the content that has only just arrived. It draws itself; a
          border-radius div could only ever have faded in. */}
      {/* Traced by the reader's own scroll toward About, rather than played at
          them on arrival: the mark is drawn by the movement it is inviting. */}
      {/*
        A rail down the page, not a mark on a screen.

        Three wrong turns before this, all of them variations on holding it.
        Anything held can only be as long as the window, so it was either a
        short tick or a line drawn below the fold where nobody saw it. This
        starts just under where the plate ended and runs all the way down to
        About's heading -- most of a thousand pixels at a laptop window -- and
        the reader travels along it rather than looking at it. It is finished,
        pointing, exactly as About's panel reaches the top.
      */}
      </div>

      <HeroScrollCue
        onActivate={scrollToAbout}
        run={cueRun}
        presented={cuePresented && introReady && !avatarActive}
        onFocusRelease={releaseCueFocus}
        onDrawComplete={onCueDrawComplete}
      />
    </section>
  );
}
/**
 * The scroll cue, and only the scroll cue, re-rendering as the hero leaves.
 *
 * Only the cue's paths re-render as scroll draws the connection.
 */
function HeroScrollCue({ onActivate, run, presented, onFocusRelease, onDrawComplete }: {
  onActivate: () => void;
  run: number;
  presented: boolean;
  onFocusRelease: () => void;
  onDrawComplete: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const publish = (next: number) => {
      // Finer than the stroke can show, and it drops the steps a slow scroll
      // spends re-reporting a value the line already sits at.
      setProgress((current) =>
        next === 0 || next === 1 || Math.abs(current - next) >= 0.002 ? next : current
      );
    };

    publish(getHeroCue());
    return subscribeHeroCue(publish);
  }, []);

  useLayoutEffect(() => {
    if (progress === 1) onDrawComplete();
  }, [onDrawComplete, progress]);

  const cue = (
    <ScrollCue
      className={styles.scrollCue}
      progress={progress}
      run={run}
      presented={presented}
      onActivate={onActivate}
      onFocusRelease={onFocusRelease}
      label="Scroll to about section"
    />
  );

  /*
   * Rendered at body level, above About's held overlay.
   *
   * That overlay is fixed and sits at z-index 40 in its own portal, so nothing
   * inside the scrolling layer can paint over it however it is stacked -- the
   * mark was being drawn correctly and hidden completely at exactly the moment
   * it mattered. Its position is a viewport coordinate now, written per frame
   * by the driver above.
   */
  if (typeof document === 'undefined') return cue;
  return createPortal(cue, document.body);
}
