import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import styles from './TitlePixelTransition.module.css';

export interface TitlePixelTransitionProps {
  /** Sequence progress where title pixel dissolve begins (AFTER background pixel transition completes). Default: 0.88 */
  start?: number;
  /** Sequence progress where "Education" is fully written and locked in place. Default: 1.0 */
  end?: number;
  initialTitle?: string;
  initialSubtitle?: string;
  flippedTitle?: string;
  flippedSubtitle?: string;
  className?: string;
  testId?: string;
}

interface PixelDotData {
  id: string;
  row: number;
  col: number;
  threshold: number;
}

function generateDots(cols: number, rows: number): PixelDotData[] {
  const dots: PixelDotData[] = [];
  let index = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sweep = c / Math.max(1, cols - 1);
      const seed = ((c + 1) * 31 + (r + 1) * 47) % 100;
      const colCluster = (((Math.floor(c / 2) + 1) * 23 + (r + 1) * 29) % 100) / 100;
      // 55% left-to-right sweep + 30% organic column cluster + 15% noise
      const raw = sweep * 0.55 + colCluster * 0.30 + (seed / 100) * 0.15;
      const threshold = Number(Math.min(1, Math.max(0, raw)).toFixed(3));

      dots.push({
        id: `dot-${index++}`,
        row: r,
        col: c,
        threshold,
      });
    }
  }

  return dots;
}

const DEFAULT_COLS = 20;
const DEFAULT_ROWS = 4;

export function TitlePixelTransition({
  start = 0.88,
  end = 1.0,
  initialTitle = 'About Me',
  initialSubtitle = 'Architecting resilient full-stack systems, 3D graphics engines, and intelligent web agents.',
  flippedTitle = 'Education',
  flippedSubtitle = 'Academic Foundations & Industry Certifications',
  className,
  testId = 'title-pixel-transition',
}: TitlePixelTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dotElementsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const titleElRef = useRef<HTMLHeadingElement | null>(null);
  const subtitleElRef = useRef<HTMLParagraphElement | null>(null);

  const [cols] = useState(DEFAULT_COLS);
  const [rows] = useState(DEFAULT_ROWS);
  const [dots] = useState<PixelDotData[]>(() => generateDots(DEFAULT_COLS, DEFAULT_ROWS));

  // Contrasting text color (pure white on contrary emerald green in both light and dark modes)
  const resolvedDotColor = '#ffffff';

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read sequence progress from container, closest overlay, active overlay in DOM, or computed style
    let rawSeq = container.style.getPropertyValue('--seq').trim();
    if (!rawSeq) {
      const overlay = container.closest<HTMLElement>('[data-active]');
      if (overlay) rawSeq = overlay.style.getPropertyValue('--seq').trim();
    }
    if (!rawSeq && typeof document !== 'undefined') {
      const activeOverlay = document.querySelector<HTMLElement>('[data-testid*="sequence-overlay"][data-active="true"]') ||
                            document.querySelector<HTMLElement>('[data-active="true"][style*="--seq"]');
      if (activeOverlay) rawSeq = activeOverlay.style.getPropertyValue('--seq').trim();
    }
    if (!rawSeq) {
      const computed = getComputedStyle(container);
      rawSeq = computed.getPropertyValue('--seq').trim();
    }
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;

    const isLightMode =
      typeof document !== 'undefined' &&
      document.documentElement.dataset.theme === 'light';

    // Before background transition (seq < 0.85): text is dark in light mode
    // When background is green (seq >= 0.85): text is pure contrast white (#ffffff)
    const isGreenBg = seq >= 0.85;
    const textColor = isLightMode && !isGreenBg ? '#111827' : '#ffffff';
    const subColor = isLightMode && !isGreenBg ? '#374151' : 'rgba(255, 255, 255, 0.9)';

    if (titleElRef.current) {
      titleElRef.current.style.color = textColor;
    }
    if (subtitleElRef.current) {
      subtitleElRef.current.style.color = subColor;
    }

    const span = Math.max(0.01, end - start);
    const p = Math.min(1, Math.max(0, (seq - start) / span));

    const totalDots = dots.length;

    // Step 0: Initial state before pixel dissolve begins (p <= 0.02)
    if (p <= 0.02) {
      if (titleElRef.current) {
        if (titleElRef.current.textContent !== initialTitle) {
          titleElRef.current.textContent = initialTitle;
        }
        titleElRef.current.style.opacity = '1';
      }
      if (subtitleElRef.current) {
        if (subtitleElRef.current.textContent !== initialSubtitle) {
          subtitleElRef.current.textContent = initialSubtitle;
        }
        subtitleElRef.current.style.opacity = '0.9';
      }
      for (let i = 0; i < totalDots; i++) {
        const el = dotElementsRef.current[i];
        if (el && el.dataset.active !== 'false') el.dataset.active = 'false';
      }
      return;
    }

    // Step 1: Phase 1 (0.02 to 0.45) - White pixel dots spawn with organic noise, covering & dissolving "About Me"
    if (p < 0.45) {
      const p1 = (p - 0.02) / 0.43; // 0 -> 1

      if (titleElRef.current) {
        if (titleElRef.current.textContent !== initialTitle) {
          titleElRef.current.textContent = initialTitle;
        }
        // Text dissolves as white pixel dots multiply over it
        titleElRef.current.style.opacity = Math.max(0, 1 - p1 * 1.8).toFixed(2);
      }

      if (subtitleElRef.current) {
        if (subtitleElRef.current.textContent !== initialSubtitle) {
          subtitleElRef.current.textContent = initialSubtitle;
        }
        subtitleElRef.current.style.opacity = Math.max(0, 0.9 - p1 * 2.0).toFixed(2);
      }

      // Activate white pixel dots with organic clustering
      for (let i = 0; i < totalDots; i++) {
        const el = dotElementsRef.current[i];
        const dot = dots[i];
        if (!el || !dot) continue;
        const isActive = p1 >= dot.threshold;
        const activeStr = String(isActive);
        if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
      }
      return;
    }

    // Step 2: Phase 2 (0.45 to 0.82) - "Education" starts being written / emerging within animated pixel dots
    if (p < 0.82) {
      const p2 = (p - 0.45) / 0.37; // 0 -> 1

      if (titleElRef.current) {
        // Character by character emergence inside pixel field: E -> Ed -> Edu -> ... -> Education
        const numChars = Math.max(
          1,
          Math.min(flippedTitle.length, Math.ceil(p2 * flippedTitle.length))
        );
        const written = flippedTitle.slice(0, numChars);
        if (titleElRef.current.textContent !== written) {
          titleElRef.current.textContent = written;
        }
        titleElRef.current.style.opacity = Math.min(1, 0.6 + p2 * 0.4).toFixed(2);
      }

      if (subtitleElRef.current) {
        if (subtitleElRef.current.textContent !== flippedSubtitle) {
          subtitleElRef.current.textContent = flippedSubtitle;
        }
        subtitleElRef.current.style.opacity = Math.min(0.9, p2 * 1.2).toFixed(2);
      }

      // Keep pixel dots animated across the writing phase
      for (let i = 0; i < totalDots; i++) {
        const el = dotElementsRef.current[i];
        const dot = dots[i];
        if (!el || !dot) continue;
        // Dots remain active to form the energetic pixel field around typing letters
        const isActive = dot.threshold >= p2 * 0.4;
        const activeStr = String(isActive);
        if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
      }
      return;
    }

    // Step 3: Phase 3 (0.82 to 1.00) - Pixel dots clear away, leaving crisp clean title "Education"
    const p3 = Math.min(1, (p - 0.82) / 0.18); // 0 -> 1

    if (titleElRef.current) {
      if (titleElRef.current.textContent !== flippedTitle) {
        titleElRef.current.textContent = flippedTitle;
      }
      titleElRef.current.style.opacity = '1';
    }

    if (subtitleElRef.current) {
      if (subtitleElRef.current.textContent !== flippedSubtitle) {
        subtitleElRef.current.textContent = flippedSubtitle;
      }
      subtitleElRef.current.style.opacity = '0.95';
    }

    // Pixel dots clear away left-to-right
    for (let i = 0; i < totalDots; i++) {
      const el = dotElementsRef.current[i];
      const dot = dots[i];
      if (!el || !dot) continue;
      const isActive = p3 < 0.98 && p3 < dot.threshold;
      const activeStr = String(isActive);
      if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
    }
  }, [
    start,
    end,
    initialTitle,
    initialSubtitle,
    flippedTitle,
    flippedSubtitle,
    dots,
  ]);

  useEffect(() => {
    update();
    const unsubscribe = subscribeScrollProgress(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [update]);

  return (
    <div
      ref={containerRef}
      className={`${styles.titleWrapper} ${className ?? ''}`}
      style={
        {
          ['--pixel-dot-color' as string]: resolvedDotColor,
          ['--dot-cols' as string]: cols,
          ['--dot-rows' as string]: rows,
        } as React.CSSProperties
      }
      data-testid={testId}
    >
      <div className={styles.titleBox}>
        <h2
          ref={titleElRef}
          className={styles.title}
          data-testid={`${testId}-heading`}
        >
          {initialTitle}
        </h2>

        {/* Contrasting pixel-dot grid strictly covering the title text box */}
        <div
          className={styles.pixelGrid}
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          data-testid={`${testId}-grid`}
          aria-hidden="true"
        >
          {dots.map((dot, idx) => (
            <span
              key={dot.id}
              ref={(el) => {
                dotElementsRef.current[idx] = el;
              }}
              className={styles.pixelDot}
              data-active="false"
              data-testid={`${testId}-dot`}
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
