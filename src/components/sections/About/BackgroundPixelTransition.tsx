import { useEffect, useRef, useState, useCallback, useContext } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { ThemeContext, type Theme } from '../theme/ThemeContext';
import styles from './BackgroundPixelTransition.module.css';

export interface BackgroundPixelTransitionProps {
  /** Sequence progress where transition starts. Default: 0.78 (after statement 2 has disappeared). */
  start?: number;
  /** Sequence progress where transition ends. Default: 1.0. */
  end?: number;
  color?: string;
  className?: string;
  testId?: string;
}

interface PixelCellData {
  id: string;
  row: number;
  col: number;
  threshold: number;
}

/**
 * Calculates responsive grid dimensions.
 */
function getGridConfig(width: number, height: number): { cols: number; rows: number } {
  const safeWidth = Math.max(width, 320);
  const safeHeight = Math.max(height, 480);

  const cols = safeWidth >= 1280 ? 10 : safeWidth >= 768 ? 8 : 6;
  const cellSize = safeWidth / cols;
  const rows = Math.max(4, Math.ceil(safeHeight / cellSize));

  return { cols, rows };
}

/**
 * Generates cells with bottom-up stepped thresholds inspired by runrobrun.com.
 * In CSS Grid, row 0 is at the top, row rows - 1 is at the bottom.
 * Bottom row (r = rows - 1) has threshold closest to 0 (activates earliest).
 * Top row (r = 0) has threshold closest to 1 (activates latest).
 */
function generateCells(cols: number, rows: number): PixelCellData[] {
  const cells: PixelCellData[] = [];
  let index = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = ((r + 1) * 19 + (c + 1) * 23) % 100;
      const colCluster =
        (((Math.floor(r / 1.5) + 1) * 29 + (Math.floor(c / 1.5) + 1) * 31) % 100) / 100;

      // Bottom-to-top rise factor: 0 at the bottom row (r = rows - 1), 1 at the top row (r = 0)
      const riseFactor = 1 - (r + 0.5) / rows;
      // Vertical rise (68%) + organic column cluster variations (14%) + subtle noise (8%)
      const raw = riseFactor * 0.68 + colCluster * 0.14 + (seed / 100) * 0.08;
      const threshold = Number(Math.min(1, Math.max(0, raw)).toFixed(3));

      cells.push({
        id: `bg-cell-${index++}`,
        row: r,
        col: c,
        threshold,
      });
    }
  }

  return cells;
}

export function BackgroundPixelTransition({
  start = 0.78,
  end = 1.0,
  color,
  className,
  testId = 'bg-pixel-transition',
}: BackgroundPixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const maskBackdropRef = useRef<SVGRectElement | null>(null);
  const cellElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const maskCellElementsRef = useRef<(SVGRectElement | null)[]>([]);
  const [cells, setCells] = useState<PixelCellData[]>([]);
  const [cols, setCols] = useState(10);
  const [rows, setRows] = useState(6);
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

  const updateGrid = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { cols: c, rows: r } = getGridConfig(window.innerWidth, window.innerHeight);
    setCols(c);
    setRows(r);
    setCells(generateCells(c, r));
  }, []);

  useEffect(() => {
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, [updateGrid]);

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read sequence progress from container or parent overlay
    const computed = getComputedStyle(container);
    const rawSeq = computed.getPropertyValue('--seq').trim();
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;

    // Transition progress: 0 when seq <= start, 1 when seq >= end
    const span = Math.max(0.01, end - start);
    const p = Math.min(1, Math.max(0, (seq - start) / span));

    const aboutSection = typeof document !== 'undefined' ? document.getElementById('about') : null;

    if (p <= 0.005) {
      if (backdropRef.current) backdropRef.current.dataset.active = 'false';
      if (maskBackdropRef.current) maskBackdropRef.current.setAttribute('opacity', '0');
      if (aboutSection && aboutSection.getAttribute('data-bg-transition') === 'true') {
        aboutSection.removeAttribute('data-bg-transition');
      }
      if (typeof document !== 'undefined') {
        document.documentElement.removeAttribute('data-navbar-contrary');
      }
      cellElementsRef.current.forEach((el) => {
        if (el && el.dataset.active !== 'false') {
          el.dataset.active = 'false';
        }
      });
      maskCellElementsRef.current.forEach((el) => {
        if (el) el.setAttribute('opacity', '0');
      });
      return;
    }

    if (reducedMotion) {
      if (backdropRef.current) {
        backdropRef.current.dataset.active = String(p > 0.1);
      }
      if (maskBackdropRef.current) {
        maskBackdropRef.current.setAttribute('opacity', p > 0.1 ? '1' : '0');
      }
      if (aboutSection) {
        if (p > 0.1) {
          aboutSection.setAttribute('data-bg-transition', 'true');
          document.documentElement.setAttribute('data-navbar-contrary', 'true');
        } else {
          aboutSection.removeAttribute('data-bg-transition');
          document.documentElement.removeAttribute('data-navbar-contrary');
        }
      }
      return;
    }

    // Once pixels have fully climbed, engage solid backdrop and section background
    const isBackdropActive = p >= 0.95;
    if (backdropRef.current) {
      backdropRef.current.dataset.active = String(isBackdropActive);
    }
    if (maskBackdropRef.current) {
      maskBackdropRef.current.setAttribute('opacity', isBackdropActive ? '1' : '0');
    }
    if (aboutSection) {
      if (isBackdropActive && aboutSection.getAttribute('data-bg-transition') !== 'true') {
        aboutSection.setAttribute('data-bg-transition', 'true');
        document.documentElement.setAttribute('data-navbar-contrary', 'true');
      } else if (p < 0.80 && aboutSection.getAttribute('data-bg-transition') === 'true') {
        aboutSection.removeAttribute('data-bg-transition');
        document.documentElement.removeAttribute('data-navbar-contrary');
      }
    }

    // Update each cell's activation based on its bottom-up threshold
    const total = cells.length;
    for (let i = 0; i < total; i++) {
      const el = cellElementsRef.current[i];
      const maskEl = maskCellElementsRef.current[i];
      const cell = cells[i];
      const threshold = cell ? cell.threshold : 1;
      const isActive = p >= threshold;

      if (el) {
        if (isActive && el.dataset.active !== 'true') {
          el.dataset.active = 'true';
        } else if (!isActive && el.dataset.active !== 'false') {
          el.dataset.active = 'false';
        }
      }

      if (maskEl) {
        maskEl.setAttribute('opacity', isActive ? '1' : '0');
      }
    }
  }, [start, end, cells, reducedMotion]);

  useEffect(() => {
    update();
    const unsubscribe = subscribeScrollProgress(update);
    window.addEventListener('resize', update);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', update);
      if (typeof document !== 'undefined') {
        document.getElementById('about')?.removeAttribute('data-bg-transition');
        document.documentElement.removeAttribute('data-navbar-contrary');
      }
    };
  }, [update]);

  return (
    <div
      ref={containerRef}
      className={`${styles.pixelContainer} ${className ?? ''}`}
      style={
        {
          ['--bg-transition-color' as string]: resolvedColor,
          ['--bg-cols' as string]: cols,
          ['--bg-rows' as string]: rows,
        } as React.CSSProperties
      }
      data-testid={testId}
      aria-hidden="true"
    >
      {/* SVG Mask Definition for razor-sharp pure white text cutout */}
      <svg className={styles.svgDef} aria-hidden="true" width="0" height="0">
        <defs>
          <mask id="bg-pixel-transition-mask" maskContentUnits="objectBoundingBox">
            <rect x="0" y="0" width="1" height="1" fill="black" />
            <rect
              ref={maskBackdropRef}
              x="0"
              y="0"
              width="1"
              height="1"
              fill="white"
              opacity="0"
            />
            {cells.map((cell, idx) => (
              <rect
                key={cell.id}
                ref={(el) => {
                  maskCellElementsRef.current[idx] = el;
                }}
                x={cell.col / cols}
                y={cell.row / rows}
                width={1 / cols + 0.002}
                height={1 / rows + 0.002}
                fill="white"
                opacity="0"
              />
            ))}
          </mask>
        </defs>
      </svg>

      <div
        ref={backdropRef}
        className={styles.backdrop}
        data-active="false"
        data-testid={`${testId}-backdrop`}
      />

      <div className={styles.pixelGrid} data-testid={`${testId}-grid`}>
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
  );
}
