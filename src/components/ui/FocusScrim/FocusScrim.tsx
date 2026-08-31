import { useCallback, useRef, useState } from 'react';
import styles from './FocusScrim.module.css';
import { focusStrength, useViewportShareEffect } from '@/lib/scroll/viewportCoverage';

/**
 * Occludes the live 3D world behind the section that renders it.
 *
 * Long-form copy over moving terrain is unreadable at almost any opacity. The
 * scrim fades up as its section takes over the viewport and fades back out as
 * the section leaves, so the world returns between reading passages.
 *
 * Render it as a direct child of a positioned section; it measures that parent.
 *
 * The strength is written straight to the element's opacity rather than held
 * in state. There is one scrim per section and a hundred coverage steps per
 * transit, so as state this was the single largest source of re-renders on the
 * page -- each one re-rendering an entire section to change one number that
 * only the compositor ever reads.
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

/**
 * Decimal places published to the element.
 *
 * Three is finer than an opacity can show, and it means a slow scroll settles
 * on the same string for several consecutive steps -- which is what makes
 * skipping the unchanged writes below worth doing.
 */
const PRECISION = 3;

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
  const scrimRef = useRef<HTMLDivElement | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    scrimRef.current = node;
    setSection(node?.parentElement ?? null);
  }, []);

  useViewportShareEffect(section, (share) => {
    const scrim = scrimRef.current;
    if (!scrim) return;

    const strength = focusStrength(share, 1);
    const opacity = (strength * maxOpacity).toFixed(PRECISION);

    // Every style write invalidates the subtree whether or not the value
    // differs, and this runs for the whole length of a section's transit.
    if (scrim.style.opacity === opacity) return;

    scrim.style.opacity = opacity;
    scrim.dataset.focusStrength = strength.toFixed(PRECISION);
  });

  return (
    <div
      ref={attach}
      className={`${styles.scrim} ${styles[variant]}`}
      style={{ opacity: 0 }}
      aria-hidden="true"
      data-testid="focus-scrim"
      data-focus-strength="0.000"
      data-variant={variant}
    />
  );
}
