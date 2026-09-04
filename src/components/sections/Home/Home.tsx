import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { KineticRotator } from '../../ui/KineticText';
import { ScrollCue, cueRunForHeight, cueRunOffset } from '../../ui/ScrollCue';
import { LiquidFillText } from '../../ui/LiquidFillText';
import styles from './Home.module.css';
import { useSectionFocusEffect } from '@/lib/scroll/useSectionFocus';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import {
  HERO_SCREENS,
  cueDraw,
  cuePresence,
  cueRail,
  cueRest,
  holdExit,
  holdProgress,
  innerExit,
  pinOffset,
  plateShut,
  INNER_EXIT_MS,
  PLATE_CLOSE_MS,
  INNER_ENTER,
  INNER_RELEASE,
  PLATE_ENTER,
  PLATE_RELEASE,
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
  exitStyle,
  sequenceDuration,
} from '@/lib/motion/sectionChoreography';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { HeroAperture } from './HeroAperture';

/**
 * Rendered width of the cue, matching the stylesheet.
 *
 * The mark is drawn at a fixed aspect, so its width is what its length is
 * measured against; stated here because the run has to be computed from both.
 */
const CUE_WIDTH_PX = 60;

/**
 * How long to wait for an entrance that never starts.
 *
 * Every entrance layer begins hidden and the animations are CSS, so a tab that
 * is served no frames gets no observer callback and would show an empty hero
 * for ever. Long enough that it can never cut a real sequence short.
 */
const NEVER_ENTERED_MS = 15000;

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
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

export function Home({ onNavigate, theme = 'dark', flat = false }: HomeProps) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);


  const reducedMotion = getPrefersReducedMotion();

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
   * Shared focus lifecycle: a timed entry that plays once, and an exit that is
   * scrubbed from scroll. See SECTION_CHOREOGRAPHY.md.
   *
   * Only the entry latch comes back as a value. The exit is a transform, and
   * it is written straight to the element: as state it re-rendered the whole
   * hero -- the filling headline, the word rotator, both magnetic buttons --
   * on each of a hundred coverage steps, to move one translate.
   */
  // Only the arrival latch is needed from the observer now; the departure is
  // driven by the hold below, which is measured per frame.
  const hasEntered = useSectionFocusEffect(sectionElement, () => {});

  /*
   * The handover's two beats, and the frame loop that runs them.
   *
   * Refs rather than state: these change every frame while a beat is running,
   * and re-rendering the hero -- the filling headline, the rotator, both
   * magnetic buttons -- to move one clip-path is the thing this whole file is
   * built to avoid.
   */
  const innerPhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const platePhaseRef = useRef<PhaseState>(PHASE_AT_REST);
  const innerActiveRef = useRef(false);
  const plateActiveRef = useRef(false);
  const frameRef = useRef(0);
  const lastFrameRef = useRef(0);
  const settledRef = useRef(false);

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

    /*
     * One frame of both beats.
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
      platePhaseRef.current = advancePhase(
        platePhaseRef.current,
        plateActiveRef.current,
        dt,
        PLATE_CLOSE_MS
      );
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
     * the moment both have arrived. `apply` calls this on every scroll, so a
     * beat that is already finished costs one comparison rather than a frame.
     */
    const startPhaseLoop = () => {
      if (frameRef.current !== 0) return;
      if (
        isPhaseAtTarget(innerPhaseRef.current, innerActiveRef.current) &&
        isPhaseAtTarget(platePhaseRef.current, plateActiveRef.current)
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

      const top = section.getBoundingClientRect().top;
      const progress = holdProgress(top, holdLength);

      const offset = `${Math.round(pinOffset(top, holdLength))}px`;
      if (pinned.style.getPropertyValue('--pin') !== offset) {
        pinned.style.setProperty('--pin', offset);
      }

      /*
       * The cue is measured from the raw offset, not from `progress`: it keeps
       * drawing after the release, across the boundary it exists to bridge.
       *
       * Reduced motion has no hold to draw across, so the mark is simply
       * present rather than traced. Left to the measurement it would sit at
       * zero forever -- the affordance vanishing for exactly the readers least
       * able to infer it from the motion that is no longer there.
       */
      setHeroCue(
        reducedMotion
          ? 1
          : cueDraw(top, holdLength, heldTopRef.current)
      );

      /*
       * The finished mark keeps its place until About's own copy arrives, then
       * leaves as the copy takes over. Written to the section so the cue's own
       * rule can read them without Home re-rendering.
       */
      if (!reducedMotion) {
        /*
         * Written to the root, because the mark is rendered through a portal.
         *
         * About's held stretch is a fixed, body-level overlay at z-index 40, so
         * nothing nested inside the scrolling layer can paint over it -- the
         * mark was at full opacity, in the right place, and behind the panel.
         * It lives at body level too now, which means its position has to be a
         * viewport coordinate rather than an offset inside the hero.
         */
        const root = document.documentElement.style;
        const held = heldTopRef.current;
        const rail = railRef.current;
        const scrolled = Math.max(-top, 0);

        const y = `${Math.round(
          rail.top - scrolled + cueRest(top, held, window.innerHeight)
        )}px`;
        if (root.getPropertyValue('--cue-y') !== y) root.setProperty('--cue-y', y);

        const presence = cuePresence(top, held, window.innerHeight).toFixed(3);
        if (root.getPropertyValue('--cue-presence') !== presence) {
          root.setProperty('--cue-presence', presence);
        }

        /*
         * How much of the line is down, so it can be faded rather than cut.
         *
         * The mark was hidden outright at zero progress, because an offset
         * dash still paints its round cap and leaves a bright dot sitting on
         * the hero. That is fine on the way in, where nothing has been drawn
         * yet -- but on the way back up the line shrinks smoothly to nothing
         * and then vanished on one frame, which reads as a glitch. Ramping it
         * over the last of the drawing gets rid of the dot and the cut both.
         */
        const drawn = getHeroCue().toFixed(3);
        if (root.getPropertyValue('--cue-drawn') !== drawn) {
          root.setProperty('--cue-drawn', drawn);
        }
      }

      if (!content) return;

      /*
       * Two phases, in order: the copy leaves, and then the plate shuts around
       * where it was. Published separately because they must not overlap --
       * shutting the plate under copy that is still on it pulls the floor out
       * from under it.
       */
      /*
       * Scroll says *whether*, not *how far*.
       *
       * Both numbers used to be read straight out of `progress`, which glued
       * them to the wheel: a notch is a discrete hundred-pixel jump, so the
       * copy left and the plate shut in the same lumps the input arrived in.
       * Now scroll only flips two triggers and the beats run on their own
       * clock. The custom properties are unchanged, so every layer's stagger
       * and the eyelid itself carry on reading exactly what they always read.
       *
       * Reduced motion keeps the scrub. There is no hold to play across and no
       * self-running movement wanted, so the block simply tracks the scroll to
       * its single fade -- and, importantly, still reaches a shut plate, which
       * is what takes the hero out of the way of everything after it.
       */
      let inner: number;
      let shut: number;

      if (reducedMotion) {
        inner = innerExit(progress);
        shut = plateShut(progress);
      } else {
        innerActiveRef.current = phaseGate(
          progress,
          innerActiveRef.current,
          INNER_ENTER,
          INNER_RELEASE
        );

        /*
         * The plate waits for the copy's beat to have *finished*, not merely
         * for the scroll to have passed a mark. On a slow frame the reader can
         * cross the threshold while a layer is still on its way out, and
         * shutting the plate under standing copy pulls the floor from under it
         * -- the exact thing the two-phase split exists to prevent.
         */
        plateActiveRef.current =
          innerPhaseRef.current.t >= 1 &&
          phaseGate(
            progress,
            plateActiveRef.current,
            PLATE_ENTER,
            PLATE_RELEASE
          );

        startPhaseLoop();

        inner = innerPhaseRef.current.t;
        shut = easeInOutCubic(platePhaseRef.current.t);
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
      if (!settledRef.current && (inner > 0 || shut > 0)) {
        settledRef.current = true;
        setSettled(true);
      }

      const isVisible = shut < 0.995;

      if (reducedMotion) {
        /*
         * One fade for the whole block.
         *
         * Staggering seven layers out is motion, and motion is the thing being
         * opted out of. The block still has to leave -- a hero left printed
         * over everything after it is worse than either -- so it leaves
         * plainly, and without a hold to leave across.
         */
        const hero = exitStyle(holdExit(progress), true);
        if (content.style.opacity !== String(hero.opacity)) {
          content.style.opacity = String(hero.opacity);
        }
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
    window.addEventListener('resize', apply);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
      if (frameRef.current !== 0) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      lastFrameRef.current = 0;
    };
  }, [sectionElement, reducedMotion, held]);

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
  const railRef = useRef({ top: 0, height: 0 });
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
      const about = document.getElementById('about');
      const plate = section.querySelector<HTMLElement>('[data-cue-layer="backdrop"]');
      const pinned = pinRef.current;
      if (!about || !plate || !pinned) return false;

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
      const headingTop = Number.parseFloat(headingStyle.top);
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
      const plateBottom =
        plate.getBoundingClientRect().bottom - pinned.getBoundingClientRect().top;

      const holdLength = held ? window.innerHeight * (HERO_SCREENS - 1) : 0;
      const rail = cueRail(
        plateBottom,
        heldTop,
        headingTop,
        holdLength,
        window.innerHeight
      );
      if (rail.height <= 0) return false;

      railRef.current = rail;
      section.style.setProperty('--cue-top', `${Math.round(rail.top)}px`);
      section.style.setProperty('--cue-height', `${Math.round(rail.height)}px`);

      // The portaled mark reads its geometry from the root, for the same reason.
      const root = document.documentElement.style;
      root.setProperty('--cue-height', `${Math.round(rail.height)}px`);
      if (headingLeft > 0) {
        root.setProperty(
          '--cue-x',
          `${Math.round(headingLeft - cueRunOffset(CUE_WIDTH_PX))}px`
        );
      }
      setCueRun(cueRunForHeight(rail.height, CUE_WIDTH_PX));
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
      if (retry) clearInterval(retry);
      if (giveUp) clearTimeout(giveUp);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [sectionElement, held]);

  const [settled, setSettled] = useState(false);

  /*
   * Guarantees the hero ends up visible, however the entrance goes.
   */
  useEffect(() => {
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
      () => setSettled(true),
      hasEntered ? (sequenceDuration(HERO_SEQUENCE) + 0.8) * 1000 : NEVER_ENTERED_MS
    );
    return () => clearTimeout(settle);
  }, [hasEntered]);

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
      <div ref={pinRef} className={styles.pinned}>
      {/* Opens the world from a slit on arrival. Behind the copy, in front of
          the canvas. The exit belongs to the plate, not to this. */}
      <HeroAperture />

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
        {/* First beat: the plate wipes in under the copy, before any of it
            arrives. It is a real element so it can be sequenced at all. */}
        <div
          className={`${styles.plate} ${hasEntered ? styles.plateDrawn : ''}`}
          style={at('backdrop')}
          aria-hidden="true"
          data-cue-layer="backdrop"
        />

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

          <h1 className={styles.title} style={at('title')} data-cue-layer="title">
            <LiquidFillText
              text="Leul"
              filling={hasEntered}
              settled={settled}
              delayMs={cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={cueDuration(HERO_SEQUENCE, 'title') * 1000}
              leadMs={SNOW_LEAD * 1000}
              className="mr-3"
            />
            <LiquidFillText
              text="Tewodros"
              filling={hasEntered}
              settled={settled}
              delayMs={cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={cueDuration(HERO_SEQUENCE, 'title') * 1000}
              leadMs={SNOW_LEAD * 1000}
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
          Full-Stack Developer &amp; 3D Web Graphics Engineer crafting high-performance interactive applications, scalable distributed architectures, and award-winning digital experiences.
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

      <HeroScrollCue onActivate={scrollToAbout} run={cueRun} />
    </section>
  );
}
/**
 * The scroll cue, and only the scroll cue, re-rendering as the hero leaves.
 *
 * The cue is genuinely a function of scroll progress -- it is a line traced by
 * the reader's own movement -- so it does need a render per step. Isolating it
 * here keeps that cost to three SVG paths instead of the entire hero.
 */
function HeroScrollCue({ onActivate, run }: { onActivate: () => void; run: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    /*
     * Drawn across the boundary, starting just before the page comes unstuck.
     *
     * The cue is the handover, so it has nothing to hand over from until the
     * copy has left and the plate has shut -- and nothing to hand over TO
     * until About is on its way up. Tying it to the hold alone drew the whole
     * line while it was still below the window; tying it to the hero's exit
     * carried it off the top as soon as it was finished. It is measured from
     * the scroll itself instead, so it begins a hair before the release and
     * finishes over the screen that follows.
     */
    const publish = (next: number) => {
      // Finer than the stroke can show, and it drops the steps a slow scroll
      // spends re-reporting a value the line already sits at.
      setProgress((current) => (Math.abs(current - next) < 0.002 ? current : next));
    };

    publish(getHeroCue());
    return subscribeHeroCue(publish);
  }, []);

  const cue = (
    <ScrollCue
      className={styles.scrollCue}
      progress={progress}
      run={run}
      onActivate={onActivate}
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
