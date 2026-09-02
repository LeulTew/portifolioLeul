import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useViewportShareEffect } from '@/lib/scroll/viewportCoverage';
import { exitAmount } from '@/lib/motion/sectionChoreography';
import {
  apertureOpenness,
  bandScale,
  closeAmount,
  seamPresence,
  seamSpread,
} from '@/lib/motion/heroAperture';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import styles from './HeroAperture.module.css';

/**
 * Opens the hero from a slit, and shuts it again on the way out.
 *
 * Two bands meet across the middle of the hero with a live strip of the island
 * showing between them, then draw apart. The page's first move is the world
 * widening, which is a different thing from the world fading up: there is
 * something there from the first frame, and it grows.
 *
 * Driven by two motion values rather than one. The entry animates `opened`;
 * the scroll drives `closed` off the section's own coverage. The bands read
 * their product, so a reader who starts scrolling mid-open gets a single
 * continuous movement instead of two animations contesting one transform --
 * which is exactly what a keyframed open plus a scroll-linked close would do.
 *
 * The scroll path writes to motion values, never to state, so the hero is not
 * re-rendered as it leaves.
 */

/** Long enough to be a move, short enough not to hold up the copy. */
const OPEN_DURATION_S = 1.15;

/** A beat after mount, so the loader's own exit has finished clearing. */
const OPEN_DELAY_S = 0.14;

/**
 * Almost all of the travel up front, then a long settle.
 *
 * The shape matters more than the duration here: a symmetric ease reads as a
 * panel being resized, and this reads as something being released.
 */
const OPEN_EASE = [0.16, 1, 0.3, 1] as const;

export interface HeroApertureProps {
  /** The hero section, measured for the scroll-driven close. */
  section: HTMLElement | null;
  /** True once the hero has arrived, so the close cannot fire on the way in. */
  entered: boolean;
}

export function HeroAperture({ section, entered }: HeroApertureProps) {
  const reducedMotion = getPrefersReducedMotion();

  const opened = useMotionValue(reducedMotion ? 1 : 0);
  const closed = useMotionValue(0);

  useEffect(() => {
    if (reducedMotion) {
      opened.set(1);
      return;
    }

    const controls = animate(opened, 1, {
      duration: OPEN_DURATION_S,
      delay: OPEN_DELAY_S,
      ease: OPEN_EASE,
    });

    return () => controls.stop();
  }, [opened, reducedMotion]);

  useViewportShareEffect(section, (coverage) => {
    // A section on its way in has low coverage too, and must not be read as
    // leaving -- that would shut the aperture during its own open.
    closed.set(entered ? closeAmount(exitAmount(coverage)) : 0);
  });

  const openness = useTransform<number, number>(
    [opened, closed],
    ([open, shut]: number[]) => apertureOpenness(open, shut)
  );

  const bandScaleY = useTransform(openness, (value) => bandScale(value));
  const seamOpacity = useTransform(openness, (value) => seamPresence(value));
  const seamScaleX = useTransform(openness, (value) => seamSpread(value));

  if (reducedMotion) return null;

  return (
    <div className={styles.aperture} aria-hidden="true" data-testid="hero-aperture">
      <motion.div
        className={`${styles.band} ${styles.top}`}
        style={{ scaleY: bandScaleY }}
        data-testid="hero-aperture-top"
      />
      <motion.div
        className={`${styles.band} ${styles.bottom}`}
        style={{ scaleY: bandScaleY }}
        data-testid="hero-aperture-bottom"
      />
      <motion.div
        className={styles.seam}
        style={{ opacity: seamOpacity, scaleX: seamScaleX }}
        data-testid="hero-aperture-seam"
      />
    </div>
  );
}
