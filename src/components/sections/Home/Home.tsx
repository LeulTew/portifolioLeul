import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { KineticRotator } from '../../ui/KineticText';
import { ScrollCue, cueRunForHeight } from '../../ui/ScrollCue';
import { LiquidFillText } from '../../ui/LiquidFillText';
import styles from './Home.module.css';
import { useSectionFocusEffect } from '@/lib/scroll/useSectionFocus';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import {
  HERO_SCREENS,
  cueDraw,
  cueRail,
  holdExit,
  holdProgress,
  innerExit,
  pinOffset,
  plateShut,
} from '@/lib/motion/heroPin';
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

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
}

export function Home({ onNavigate, theme = 'dark' }: HomeProps) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);


  const reducedMotion = getPrefersReducedMotion();

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

    const apply = () => {
      const section = sectionElement;
      const pinned = pinRef.current;
      const content = contentRef.current;
      if (!section || !pinned) return;

      const holdLength = reducedMotion
        ? 0
        : window.innerHeight * (HERO_SCREENS - 1);

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
          : cueDraw(top, holdLength, railRef.current, window.innerHeight)
      );

      if (!content) return;

      /*
       * Two phases, in order: the copy leaves, and then the plate shuts around
       * where it was. Published separately because they must not overlap --
       * shutting the plate under copy that is still on it pulls the floor out
       * from under it.
       */
      const inner = innerExit(progress);
      const shut = plateShut(progress);
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
    };
  }, [sectionElement, reducedMotion]);

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
      const headingTop = Number.parseFloat(window.getComputedStyle(heading).top);
      if (!Number.isFinite(headingTop) || headingTop <= 0) return false;

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

      const holdLength = reducedMotion ? 0 : window.innerHeight * (HERO_SCREENS - 1);
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

    if (!measure()) {
      retry = setInterval(() => {
        if (measure() && retry) {
          clearInterval(retry);
          retry = undefined;
        }
      }, 120);
      giveUp = setTimeout(() => {
        if (retry) clearInterval(retry);
        retry = undefined;
      }, 4000);
    }

    window.addEventListener('resize', measure);

    /*
     * A resize listener is not enough on its own: the heading's offset is a
     * clamp against viewport height, and the boxes can settle without Home
     * hearing a resize event. An observer on them cannot miss it.
     */
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    observer?.observe(section);

    return () => {
      if (retry) clearInterval(retry);
      if (giveUp) clearTimeout(giveUp);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [sectionElement, reducedMotion]);

  const [settled, setSettled] = useState(false);

  /*
   * Guarantees the hero ends up visible, and deliberately not gated on having
   * entered. Every entrance layer starts hidden, and the entry is triggered by
   * IntersectionObserver, whose callbacks are delivered as part of the
   * rendering lifecycle -- so a tab served no frames gets no observer callback,
   * never enters, and never animates. Timers do not depend on frames.
   *
   * The hero is the first thing on the page and always on screen at load, so
   * settling on a timer from mount is safe. If the sequence played normally
   * this changes nothing.
   */
  useEffect(() => {
    const settle = setTimeout(
      () => setSettled(true),
      (sequenceDuration(HERO_SEQUENCE) + 0.8) * 1000
    );
    return () => clearTimeout(settle);
  }, []);

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
      style={{ ['--hero-screens' as string]: `${HERO_SCREENS}` }}
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

  return (
    <ScrollCue
      className={styles.scrollCue}
      progress={progress}
      run={run}
      onActivate={onActivate}
      label="Scroll to about section"
    />
  );
}
