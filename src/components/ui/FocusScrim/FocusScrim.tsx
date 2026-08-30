import { useCallback, useState } from 'react';
import styles from './FocusScrim.module.css';
import { useViewportCoverage } from '@/lib/scroll/viewportCoverage';

/**
 * Occludes the live 3D world behind the section that renders it.
 *
 * Long-form copy over moving terrain is unreadable at almost any opacity. The
 * scrim fades up as its section takes over the viewport and fades back out as
 * the section leaves, so the world returns between reading passages.
 *
 * Render it as a direct child of a positioned section; it measures that parent.
 */

/**
 * How completely a section closes out the 3D world behind it.
 *
 * `veil` keeps the world faintly present, which suits sections carrying their
 * own imagery. `solid` covers it entirely, for sections that are mostly copy.
 */
export type ScrimVariant = 'veil' | 'solid';

/** Enough to carry text contrast while the world stays faintly present. */
const VEIL_MAX_OPACITY = 0.92;

export interface FocusScrimProps {
  variant?: ScrimVariant;
  /** Peak scrim opacity. Defaults to full coverage for `solid`. */
  maxOpacity?: number;
}

export function FocusScrim({
  variant = 'veil',
  maxOpacity = variant === 'solid' ? 1 : VEIL_MAX_OPACITY,
}: FocusScrimProps = {}) {
  const [section, setSection] = useState<HTMLElement | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    setSection(node?.parentElement ?? null);
  }, []);

  const strength = useViewportCoverage(section);

  return (
    <div
      ref={attach}
      className={`${styles.scrim} ${styles[variant]}`}
      style={{ opacity: strength * maxOpacity }}
      aria-hidden="true"
      data-testid="focus-scrim"
      data-focus-strength={strength.toFixed(3)}
      data-variant={variant}
    />
  );
}
