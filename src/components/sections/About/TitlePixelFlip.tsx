import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { ThemeContext, type Theme } from '../theme/ThemeContext';
import styles from './TitlePixelFlip.module.css';

export interface TitlePixelFlipProps {
  /** Sequence progress where title flip begins (AFTER background pixel transition completes). Default: 0.88 */
  start?: number;
  /** Sequence progress where title flip finishes and locks in place. Default: 1.0 */
  end?: number;
  initialTitle?: string;
  initialSubtitle?: string;
  flippedTitle?: string;
  flippedSubtitle?: string;
  color?: string;
  className?: string;
  testId?: string;
}

interface TitleCellData {
  id: string;
  row: number;
  col: number;
  threshold: number;
}

function generateTitleCells(cols: number, rows: number): TitleCellData[] {
  const cells: TitleCellData[] = [];
  let index = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sweepFactor = (c + 0.5) / cols;
      const seed = ((c + 1) * 19 + (r + 1) * 23) % 100;
      const rowCluster =
        (((Math.floor(c / 1.5) + 1) * 29 + (Math.floor(r / 1.5) + 1) * 31) % 100) / 100;

      // Left-to-right sweep (70%) + row cluster variation (18%) + subtle noise (12%)
      const raw = sweepFactor * 0.70 + rowCluster * 0.18 + (seed / 100) * 0.12;
      const threshold = Number(Math.min(1, Math.max(0, raw)).toFixed(3));

      cells.push({
        id: `title-cell-${index++}`,
        row: r,
        col: c,
        threshold,
      });
    }
  }

  return cells;
}

export function TitlePixelFlip({
  start = 0.88,
  end = 1.0,
  initialTitle = 'About Me',
  initialSubtitle = 'Architecting resilient full-stack systems, 3D graphics engines, and intelligent web agents.',
  flippedTitle = 'Education',
  flippedSubtitle = 'Academic Foundations & Industry Certifications',
  color,
  className,
  testId = 'title-pixel-flip',
}: TitlePixelFlipProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cellElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const titleElRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleElRef = useRef<HTMLParagraphElement | null>(null);

  const [cols] = useState(14);
  const [rows] = useState(3);
  const [cells] = useState<TitleCellData[]>(() => generateTitleCells(14, 3));
  const [isFlipped, setIsFlipped] = useState(false);

  const reducedMotion = getPrefersReducedMotion();
  const themeContext = useContext(ThemeContext);
  const currentTheme: Theme =
    themeContext?.theme ??
    (typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'light'
      ? 'light'
      : 'dark');

  const resolvedColor =
    color ?? (currentTheme === 'light' ? '#0a5c40' : '#001a1a');

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read sequence progress from parent overlay custom property
    const computed = getComputedStyle(container);
    const rawSeq = computed.getPropertyValue('--seq').trim();
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;

    const span = Math.max(0.01, end - start);
    const p = Math.min(1, Math.max(0, (seq - start) / span));

    const flipped = p >= 0.5;
    setIsFlipped(flipped);

    // Update title and subtitle text in DOM
    if (titleElRef.current) {
      const targetText = flipped ? flippedTitle : initialTitle;
      if (titleElRef.current.textContent !== targetText) {
        titleElRef.current.textContent = targetText;
      }
    }

    if (subtitleElRef.current) {
      const targetSubtitle = flipped ? flippedSubtitle : initialSubtitle;
      if (subtitleElRef.current.textContent !== targetSubtitle) {
        subtitleElRef.current.textContent = targetSubtitle;
      }
      if (!reducedMotion) {
        // Subtitle fades down during flip-out and returns during flip-in
        const subOpacity = flipped
          ? Math.min(1, Math.max(0, (p - 0.5) * 2.2))
          : Math.min(1, Math.max(0, 1 - p * 2.2));
        subtitleElRef.current.style.opacity = subOpacity.toFixed(2);
      } else {
        subtitleElRef.current.style.opacity = '1';
      }
    }

    if (reducedMotion) return;

    const total = cells.length;
    for (let i = 0; i < total; i++) {
      const el = cellElementsRef.current[i];
      const cell = cells[i];
      if (!el || !cell) continue;

      let isActive = false;
      if (p <= 0.01) {
        isActive = false;
      } else if (p < 0.5) {
        // Phase 1: Flip-out (cells flip in left-to-right covering "About Me")
        const p1 = p / 0.5;
        isActive = p1 >= cell.threshold;
      } else if (p < 0.99) {
        // Phase 2: Flip-in (cells flip out left-to-right revealing "Education")
        const p2 = (p - 0.5) / 0.5;
        isActive = p2 < cell.threshold;
      } else {
        isActive = false;
      }

      const activeStr = String(isActive);
      if (el.dataset.active !== activeStr) {
        el.dataset.active = activeStr;
      }
    }
  }, [
    start,
    end,
    initialTitle,
    initialSubtitle,
    flippedTitle,
    flippedSubtitle,
    cells,
    reducedMotion,
  ]);

  useEffect(() => {
    update();
    const unsubscribe = subscribeScrollProgress(update);
    window.addEventListener('resize', update);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', update);
    };
  }, [update]);

  return (
    <div
      ref={containerRef}
      className={`${styles.flipWrapper} ${className ?? ''}`}
      style={
        {
          ['--pixel-flip-bg' as string]: resolvedColor,
          ['--title-cols' as string]: cols,
          ['--title-rows' as string]: rows,
        } as React.CSSProperties
      }
      data-testid={testId}
      data-flipped={String(isFlipped)}
    >
      <div className={styles.titleContainer}>
        <h2
          ref={titleElRef}
          className={styles.title}
          data-testid={`${testId}-heading`}
        >
          {initialTitle}
        </h2>

        {/* Pixel grid strictly covering the title text box */}
        <div
          className={styles.pixelGrid}
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          data-testid={`${testId}-grid`}
          aria-hidden="true"
        >
          {cells.map((cell, idx) => (
            <span
              key={cell.id}
              ref={(el) => {
                cellElementsRef.current[idx] = el;
              }}
              className={styles.pixelCell}
              data-active="false"
              data-testid={`${testId}-cell`}
            />
          ))}
        </div>
      </div>

      <p
        ref={subtitleElRef}
        className={styles.subtitle}
        data-testid={`${testId}-subtitle`}
      >
        {initialSubtitle}
      </p>
    </div>
  );
}
