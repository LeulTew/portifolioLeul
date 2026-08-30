import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { MagneticButton } from '../../ui/MagneticButton';
import { DancingCharText, KineticRotator } from '../../ui/KineticText';
import styles from './Home.module.css';
import { useSectionFocus } from '@/lib/scroll/useSectionFocus';
import {
  HERO_SEQUENCE,
  cueDelay,
  cueDuration,
  exitStyle,
  sequenceDuration,
} from '@/lib/motion/sectionChoreography';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
}

export function Home({ onNavigate, theme = 'dark' }: HomeProps) {
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  // Shared focus lifecycle: a timed entry that plays once, and an exit that is
  // scrubbed from scroll. See SECTION_CHOREOGRAPHY.md.
  const { hasEntered, exit } = useSectionFocus(sectionElement);
  const reducedMotion = getPrefersReducedMotion();

  const hero = exitStyle(exit, reducedMotion);
  const isVisible = exit < 0.98;

  // Type is GSAP's half of the sequence: a per-line timeline with its own
  // internal stagger, which would need a component per node in Framer.
  useLayoutEffect(() => {
    if (!hasEntered) return;
    const scope = copyRef.current;
    if (!scope) return;

    const context = gsap.context(() => {
      const cue = (id: string) => ({
        delay: cueDelay(HERO_SEQUENCE, id),
        duration: cueDuration(HERO_SEQUENCE, id),
      });

      if (reducedMotion) {
        // One fade, no movement, everything at once.
        gsap.fromTo(
          '[data-cue]',
          { opacity: 0 },
          { opacity: 1, duration: 0.4, ease: 'none' }
        );
        return;
      }

      for (const id of ['title', 'role', 'description']) {
        const { delay, duration } = cue(id);
        gsap.fromTo(
          `[data-cue="${id}"]`,
          { opacity: 0, yPercent: 40, filter: 'blur(8px)' },
          {
            opacity: 1,
            yPercent: 0,
            filter: 'blur(0px)',
            duration,
            delay,
            ease: 'expo.out',
          }
        );
      }
    }, scope);

    /*
     * Backstop. `fromTo` applies its start state synchronously but animates on
     * requestAnimationFrame, so in a tab that is never served frames the copy
     * would sit at opacity 0 indefinitely. A timer settles it to the finished
     * pose; if the sequence already played this is a no-op.
     */
    const settle = setTimeout(
      () => {
        gsap.set(scope.querySelectorAll('[data-cue]'), {
          opacity: 1,
          yPercent: 0,
          filter: 'none',
        });
      },
      (sequenceDuration(HERO_SEQUENCE) + 0.6) * 1000
    );

    return () => {
      clearTimeout(settle);
      context.revert();
    };
  }, [hasEntered, reducedMotion]);

  // A profile-image travel driven by viewport scrollY used to sit here. This
  // page scrolls inside the ScrollControls element, so that value never moved
  // and both transforms returned their constants forever. The hero exit is
  // driven by inViewRatio above, which does work.

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
      <div
        ref={copyRef}
        className={styles.content}
        style={{
          ...hero,
          pointerEvents: isVisible ? 'auto' : 'none',
          visibility: isVisible ? 'visible' : 'hidden',
        }}
      >
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={hasEntered ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: cueDuration(HERO_SEQUENCE, 'backdrop'),
            ease: [0.76, 0, 0.24, 1],
            delay: cueDelay(HERO_SEQUENCE, 'backdrop'),
          }}
        >
          <motion.div
            className={styles.imageContainer}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={hasEntered ? { opacity: 1, scale: 1 } : undefined}
            transition={{
              duration: cueDuration(HERO_SEQUENCE, 'portrait'),
              ease: [0.76, 0, 0.24, 1],
              delay: cueDelay(HERO_SEQUENCE, 'portrait'),
            }}
          >
            <div className={styles.imagePlaceholder}>
              <span className={styles.circleText}>L</span>
              <img 
                src="/images/leul-profile.webp" 
                alt="Leul" 
                className={styles.circleImage}
              />
            </div>
          </motion.div>

          <h1 className={styles.title} data-cue="title">
            <DancingCharText text="Leul" className="mr-3" />
            <DancingCharText text="Tewodros" className={styles.lastname} />
          </h1>

          <div className={styles.info} data-cue="role">
            <span className="opacity-80">ARCHITECTING</span>
            <KineticRotator words={['FULL-STACK APPS', 'THREE.JS 3D EXPERIENCES', 'INTELLIGENT SYSTEMS', 'HIGH-PERFORMANCE UI']} />
          </div>
        </motion.div>

        <p className={styles.description} data-cue="description">
          Full-Stack Developer &amp; 3D Web Graphics Engineer crafting high-performance interactive applications, scalable distributed architectures, and award-winning digital experiences.
        </p>

        {/* Magnetic CTA Buttons */}
        <motion.div
          className="flex flex-wrap items-center gap-4 mt-6 pointer-events-auto"
          initial={{ opacity: 0, y: 15 }}
          animate={hasEntered ? { opacity: 1, y: 0 } : undefined}
          transition={{
            duration: cueDuration(HERO_SEQUENCE, 'actions'),
            delay: cueDelay(HERO_SEQUENCE, 'actions'),
          }}
        >
          <MagneticButton onClick={scrollToAbout} variant="primary" theme={theme}>
            Explore My Work
          </MagneticButton>
          <MagneticButton onClick={scrollToContact} variant="secondary" icon={false} theme={theme}>
            Get In Touch
          </MagneticButton>
        </motion.div>
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

      {/* Last cue: the scroll affordance invites the next move, so it must not
          compete with the content that has only just arrived. */}
      <motion.div
        className={styles.scrollArrow}
        initial={{ opacity: 0, y: -12 }}
        // Enters on its cue, then follows the section out: one property, so
        // the entry and the scrubbed exit never fight over it.
        animate={hasEntered ? { opacity: hero.opacity, y: 0 } : undefined}
        transition={{
          duration: cueDuration(HERO_SEQUENCE, 'affordance'),
          ease: [0.16, 1, 0.3, 1],
          delay: cueDelay(HERO_SEQUENCE, 'affordance'),
        }}
        onClick={scrollToAbout}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            scrollToAbout();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Scroll to about section"
      >
        <div className={styles.curve} />
        <div className={styles.point} />
      </motion.div>
    </section>
  );
}