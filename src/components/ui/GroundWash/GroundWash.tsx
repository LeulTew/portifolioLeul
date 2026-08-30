import styles from './GroundWash.module.css';
import { groundFor, type ThemeName } from './groundPalette';

/**
 * The ground of a held section, arriving as water rises rather than as a panel
 * fading up.
 *
 * A fade puts the whole ground on screen at a fraction of its strength, so for
 * the length of the transition the reader sees the world through a haze -- the
 * page dimming rather than something covering it. A rising line covers it
 * properly from the bottom, and there is a moment where you can see exactly how
 * far it has come.
 *
 * The line carries a scalloped surface, the same shape the headline fills
 * behind, so the two read as the same weather rather than two effects.
 *
 * Driven by a custom property set by the sequence, so nothing here re-renders
 * while it moves.
 */

export interface GroundWashProps {
  /** Section whose ground this is; picks the colour out of the palette. */
  section: string;
  theme?: ThemeName;
  /** Name of the property carrying the rise, 0 to 1. */
  rise?: string;
  className?: string;
}

export function GroundWash({
  section,
  theme = 'dark',
  rise = '--ground-in',
  className,
}: GroundWashProps) {
  const ground = groundFor(section, theme);

  return (
    <div
      className={[styles.wash, className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-testid="ground-wash"
      data-section={section}
      style={{
        ['--rise' as string]: `var(${rise}, 0)`,
        ['--ground-base' as string]: ground.base,
        ['--ground-surface' as string]: ground.surface,
      }}
    >
      <div className={styles.body} />
      <div className={styles.surface} />
    </div>
  );
}
