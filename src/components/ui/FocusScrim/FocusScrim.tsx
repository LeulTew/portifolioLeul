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

/** Enough to carry text contrast while the world stays faintly present. */
const DEFAULT_MAX_OPACITY = 0.92;

export interface FocusScrimProps {
  /** Peak scrim opacity. */
  maxOpacity?: number;
}

export function FocusScrim({ maxOpacity = DEFAULT_MAX_OPACITY }: FocusScrimProps = {}) {
  const [section, setSection] = useState<HTMLElement | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    setSection(node?.parentElement ?? null);
  }, []);

  const strength = useViewportCoverage(section);

  return (
    <div
      ref={attach}
      className={styles.scrim}
      style={{ opacity: strength * maxOpacity }}
      aria-hidden="true"
      data-testid="focus-scrim"
      data-focus-strength={strength.toFixed(3)}
    />
  );
}
