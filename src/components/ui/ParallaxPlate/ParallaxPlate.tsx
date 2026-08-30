import styles from './ParallaxPlate.module.css';
import { layerShift, DEPTHS } from './depth';

/**
 * The visual that occupies the space beside a statement.
 *
 * Concentric planes at four depths, drifting against each other as the stage
 * moves through the viewport. Geometry rather than imagery: the section's
 * subject is the writing, and anything with a subject of its own beside it
 * competes for the same attention.
 */

export interface ParallaxPlateProps {
  /** 0 as the stage arrives, 1 as it leaves. */
  progress?: number;
  /** How present the stage is, 0 to 1. Fades the whole plate with it. */
  presence?: number;
  /** Mirrors the geometry, so the two stages are not the same picture twice. */
  flipped?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

/** How far the nearest plane travels across a stage, in px. */
const TRAVEL_PX = 64;

export function ParallaxPlate({
  progress = 0.5,
  presence = 1,
  flipped = false,
  reducedMotion = false,
  className,
}: ParallaxPlateProps) {
  return (
    <div
      className={[styles.plate, flipped ? styles.flipped : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      data-testid="parallax-plate"
      style={{ opacity: presence }}
    >
      {DEPTHS.map((depth, index) => (
        <span
          key={depth}
          className={styles.plane}
          data-testid="parallax-plane"
          data-depth={depth}
          style={{
            transform: reducedMotion
              ? undefined
              : `translate3d(0, ${layerShift(progress, depth, TRAVEL_PX).toFixed(
                  2
                )}px, 0)`,
            // Nearer planes are drawn tighter and brighter.
            inset: `${index * 9}%`,
            opacity: 0.22 + depth * 0.5,
          }}
        />
      ))}
      <span className={styles.horizon} data-testid="parallax-horizon" />
    </div>
  );
}
