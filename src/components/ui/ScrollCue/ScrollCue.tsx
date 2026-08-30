import styles from './ScrollCue.module.css';

/**
 * The scroll affordance under the hero: a long sweeping line that draws itself,
 * with a current that runs down it once drawn.
 *
 * Replaces a border-radius `div` masquerading as a curve. A border cannot be
 * drawn on, so the old mark could only ever fade or slide; this is a real path,
 * so it can be traced.
 */

/**
 * Normalised so every dash length in the stylesheet is a percentage of the
 * path, independent of the geometry below.
 */
const PATH_LENGTH = 100;

/**
 * The original mark's geometry: a long, nearly vertical fall that drifts only
 * about 34px across as it descends 356. It reads as a line dropping away down
 * the page, not as a sweep across it.
 */
const TRACE = 'M 8 6 C 3 140, 12 262, 34 352';

/** Chevron at the foot of the fall, opening back up the way the line came. */
const HEAD = 'M 20 330 L 34 356 L 47 327';

export interface ScrollCueProps {
  /** Plays the draw. Held false until the section's cue is reached. */
  drawn?: boolean;
  /** Seconds to wait before drawing, from the section's sequence. */
  delay?: number;
  onActivate?: () => void;
  className?: string;
  label?: string;
}

export function ScrollCue({
  drawn = false,
  delay = 0,
  onActivate,
  className,
  label = 'Scroll to the next section',
}: ScrollCueProps) {
  return (
    <svg
      className={[styles.cue, drawn ? styles.drawn : '', className]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 100 380"
      preserveAspectRatio="xMidYMin meet"
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="scroll-cue"
      data-drawn={drawn}
      style={{ ['--cue-delay' as string]: `${delay}s` }}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate?.();
        }
      }}
    >
      <path
        className={`${styles.stroke} ${styles.trace}`}
        d={TRACE}
        pathLength={PATH_LENGTH}
        data-testid="scroll-cue-trace"
      />
      <path
        className={`${styles.stroke} ${styles.head}`}
        d={HEAD}
        pathLength={PATH_LENGTH}
      />
      {/* Rides the same geometry as the trace, so the current follows the line. */}
      <path
        className={styles.current}
        d={TRACE}
        pathLength={PATH_LENGTH}
        data-testid="scroll-cue-current"
      />
    </svg>
  );
}
