import styles from './GroundWash.module.css';
import { groundFor, type ThemeName } from './groundPalette';

/**
 * The ground of a held section: the colour that covers the world while its copy
 * is being read.
 *
 * Deliberately plain. It arrived behind a rising scalloped waterline at first,
 * which at full screen width was not a surface but a line travelling up the
 * page -- and a line crossing the whole screen draws the eye to the transition
 * rather than to what the transition is for.
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
      }}
    />
  );
}
