import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { GroundWash } from '../GroundWash';
import type { ThemeName } from '../GroundWash';
import { runProgress, runGround } from './runProgress';
import { localProgress } from '../PinnedSequence/localProgress';
import { setFocusPull, focusCurve } from '@/lib/camera/focusPull';
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
      if (!onScreen) {
        // Off the run there is nothing to lean toward, and a pull left behind
        // would still be applied the next time the world is held.
        setFocusPull(0);
        return;
      }

      const progress = runProgress(top, height, rootHeight);
      write(layer, '--run', progress.toFixed(3));
      write(layer, '--ground-in', runGround(progress).toFixed(3));

      if (apertureId) {
        const opener = document.getElementById(apertureId);
        const rect = opener?.getBoundingClientRect();
        const through = rect
          ? localProgress(rect.top, rect.height, rootHeight)
          : 0;

        // The ground changes depth as soon as the section starts, well before
        // the opening: the colour belongs to the section, the aperture to the
        // reading of it.
        write(layer, '--depth-in', clamp01(through * 5).toFixed(3));
        /*
         * Opens once the portal's frame is established, and stays open.
         *
         * Over a third of the held stretch rather than half of it: the cut is
         * the whole point of this section, and one that is still opening as
         * the reader leaves has not been seen.
         */
        write(layer, '--aperture-in', clamp01((through - 0.04) / 0.3).toFixed(3));

        /*
         * The camera leans toward the figure as the reader crosses this
         * section, and is back where it started by the end of it. Published
         * from here because this is already the thing measuring the section
         * once a frame; the render loop reads it without a re-render.
         */
        setFocusPull(focusCurve(through));
      }
    };

    apply();
    const unsubscribe = subscribeScrollProgress(apply);
    window.addEventListener('resize', apply);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
      setFocusPull(0);
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
      {/*
        The ground is CUT BACK to uncover the world, not covered by something
        that then slides away. A panel sliding off the right of a ground that
        still spans the whole screen reveals the ground underneath it, which is
        no reveal at all -- which is exactly what it did.
      */}
      <div className={styles.ground} data-testid="held-ground">
        <GroundWash section={from} theme={theme} rise="--ground-in" />
        {apertureId && (
          <GroundWash
            section={apertureId}
            theme={theme}
            rise="--depth-in"
            className={styles.depth}
          />
        )}
      </div>

      {apertureId && <span className={styles.edge} data-testid="held-aperture" />}
    </div>,
    document.body
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

/** Sets a property only when it differs; this runs on every frame. */
function write(element: HTMLElement, property: string, value: string): void {
  if (element.style.getPropertyValue(property) === value) return;
  element.style.setProperty(property, value);
}
