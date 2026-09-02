import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { KineticRotator } from '../../ui/KineticText';
import { ScrollCue } from '../../ui/ScrollCue';
import { LiquidFillText } from '../../ui/LiquidFillText';
import styles from './Home.module.css';
import { useSectionFocusEffect } from '@/lib/scroll/useSectionFocus';
import { useViewportShareEffect } from '@/lib/scroll/viewportCoverage';
import {
  HERO_SEQUENCE,
  cueDelay,
  cueDuration,
  exitAmount,
  exitStyle,
  sequenceDuration,
} from '@/lib/motion/sectionChoreography';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { HeroAperture } from './HeroAperture';

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
}

export function Home({ onNavigate, theme = 'dark' }: HomeProps) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

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
  const hasEntered = useSectionFocusEffect(sectionElement, ({ exit }) => {
    const content = contentRef.current;
    if (!content) return;

    const hero = exitStyle(exit, reducedMotion);
    const isVisible = exit < 0.98;

    if (content.style.opacity !== String(hero.opacity)) {
      content.style.opacity = String(hero.opacity);
    }
    if (content.style.transform !== hero.transform) {
      content.style.transform = hero.transform;
    }
    if (content.style.filter !== hero.filter) content.style.filter = hero.filter;

    const pointerEvents = isVisible ? 'auto' : 'none';
    if (content.style.pointerEvents !== pointerEvents) {
      content.style.pointerEvents = pointerEvents;
    }
    const visibility = isVisible ? 'visible' : 'hidden';
    if (content.style.visibility !== visibility) content.style.visibility = visibility;
  });

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

  /** Puts a layer on its beat, keeping the sequence in the cue list. */
  const at = (id: string) => ({ ['--cue-at' as string]: `${cueDelay(HERO_SEQUENCE, id)}s` });

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
    <section ref={setSectionElement} className={styles.home} id="home">
      {/* Opens the world from a slit on arrival, and shuts it on the way out.
          Behind the copy, in front of the canvas. */}
      <HeroAperture section={sectionElement} entered={hasEntered} />

      <div
        ref={contentRef}
        className={[
          styles.content,
          hasEntered ? styles.entered : '',
          settled ? styles.settled : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ opacity: 1, transform: 'none', filter: 'none' }}
        data-testid="hero-content"
      >
        {/* First beat: the plate wipes in under the copy, before any of it
            arrives. It is a real element so it can be sequenced at all. */}
        <div
          className={`${styles.plate} ${hasEntered ? styles.plateDrawn : ''}`}
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

          <h1 className={styles.title} data-cue-layer="title">
            <LiquidFillText
              text="Leul"
              filling={hasEntered}
              settled={settled}
              delayMs={cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={cueDuration(HERO_SEQUENCE, 'title') * 1000}
              className="mr-3"
            />
            <LiquidFillText
              text="Tewodros"
              filling={hasEntered}
              settled={settled}
              delayMs={cueDelay(HERO_SEQUENCE, 'title') * 1000}
              durationMs={cueDuration(HERO_SEQUENCE, 'title') * 1000}
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
      <HeroScrollCue
        section={sectionElement}
        entered={hasEntered}
        onActivate={scrollToAbout}
      />

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
function HeroScrollCue({
  section,
  entered,
  onActivate,
}: {
  section: HTMLElement | null;
  entered: boolean;
  onActivate: () => void;
}) {
  const [progress, setProgress] = useState(0);

  useViewportShareEffect(section, (coverage) => {
    const exit = entered ? exitAmount(coverage) : 0;
    /*
     * Complete within the first third of the hero leaving, so the line is
     * drawn while the reader is still deciding rather than once they have
     * gone.
     */
    const next = Math.min(exit / 0.3, 1);
    // Finer than the stroke can show, and it drops the steps a slow scroll
    // spends re-reporting a value the line already sits at.
    setProgress((current) => (Math.abs(current - next) < 0.002 ? current : next));
  });

  return (
    <ScrollCue
      className={styles.scrollCue}
      progress={progress}
      onActivate={onActivate}
      label="Scroll to about section"
    />
  );
}
