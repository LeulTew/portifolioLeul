import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { GroundWash } from '../GroundWash';
import type { ThemeName } from '../GroundWash';
import { runProgress, runGround } from './runProgress';
import { localProgress } from '../PinnedSequence/localProgress';
import styles from './HeldBackdrop.module.css';

/**
 * One ground for a whole run of sections.
 *
 * Each held section used to carry its own, which meant the ground went out at
 * the end of one and came back at the start of the next -- and between them
 * the world flashed through, in a different colour on either side. From the
 * reader's chair that is two backgrounds with a hole between them, not one
 * background being scrolled along.
 *
 * This is a single fixed layer spanning the run: up as the run begins, held
 * across every boundary inside it, down only as the run ends. Sections put
 * their content on it; none of them owns it.
 *
 * Portalled to the body for the same reason the pinned overlays are: `fixed`
 * resolves against the nearest transformed ancestor, and every section here
 * lives inside a transformed container.
 */

export interface HeldBackdropProps {
  /** First and last section of the run, by id. */
  from: string;
  to: string;
  /** Section whose stretch uncovers the world on one side, if any. */
  apertureId?: string;
  theme?: ThemeName;
}

export function HeldBackdrop({
  from,
  to,
  apertureId,
  theme = 'dark',
}: HeldBackdropProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const apply = () => {
      const layer = layerRef.current;
      if (!layer) return;

      const first = document.getElementById(from);
      const last = document.getElementById(to);
      if (!first || !last) return;

      const top = first.getBoundingClientRect().top;
      const height = last.getBoundingClientRect().bottom - top;
      const rootHeight = window.innerHeight;

      const onScreen = top < rootHeight && top + height > 0;
      layer.dataset.active = String(onScreen);
      if (!onScreen) return;

      const progress = runProgress(top, height, rootHeight);
      write(layer, '--run', progress.toFixed(3));
      write(layer, '--ground-in', runGround(progress).toFixed(3));

      if (apertureId) {
        const opener = document.getElementById(apertureId);
        const rect = opener?.getBoundingClientRect();
        // Opens across the section that owns it, and stays open behind it.
        const aperture = rect
          ? localProgress(rect.top, rect.height, rootHeight)
          : 0;
        write(layer, '--aperture-in', Math.min(aperture * 1.6, 1).toFixed(3));
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    window.addEventListener('resize', apply);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
    };
  }, [mounted, from, to, apertureId]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={layerRef}
      className={styles.backdrop}
      data-active="false"
      data-testid="held-backdrop"
      aria-hidden="true"
    >
      <GroundWash section={from} theme={theme} rise="--ground-in" />

      {apertureId && (
        <div className={styles.aperture} data-testid="held-aperture">
          <GroundWash section={apertureId} theme={theme} rise="--ground-in" />
        </div>
      )}
    </div>,
    document.body
  );
}

/** Sets a property only when it differs; this runs on every frame. */
function write(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) === value) return;
  element.style.setProperty(property, value);
}
