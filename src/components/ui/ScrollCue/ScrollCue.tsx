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

/** The sweep: down and out to the right, easing into its steepest fall. */
const TRACE = 'M 16 4 C 14 132, 26 250, 116 392';

/** Chevron at the tip, aligned to the curve's tangent where it lands. */
const HEAD = 'M 92 368 L 118 396 L 78 402';

export interface ScrollCueProps {
  /** Plays the draw. Held false until the section's cue is reached. */
  drawn?: boolean;
  onActivate?: () => void;
  className?: string;
  label?: string;
}

export function ScrollCue({
  drawn = false,
  onActivate,
  className,
  label = 'Scroll to the next section',
}: ScrollCueProps) {
  return (
    <svg
      className={[styles.cue, drawn ? styles.drawn : '', className]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 140 410"
      width="140"
      height="410"
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="scroll-cue"
      data-drawn={drawn}
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
