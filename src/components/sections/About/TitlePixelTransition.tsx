import { useEffect, useRef, useState, useCallback } from 'react';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
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
      const sweep = (c + 0.5) / cols;
      const seed = ((c + 1) * 17 + (r + 1) * 31) % 100;
      const cluster =
        (((Math.floor(c / 1.5) + 1) * 23 + (Math.floor(r / 1.5) + 1) * 29) % 100) / 100;
      // Sweep left-to-right (68%) + organic column cluster (20%) + noise (12%)
      const raw = sweep * 0.68 + cluster * 0.20 + (seed / 100) * 0.12;
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

  const [cols] = useState(16);
  const [rows] = useState(3);
  const [dots] = useState<PixelDotData[]>(() => generateDots(16, 3));

  const reducedMotion = getPrefersReducedMotion();

  // Contrasting text color (pure white on contrary emerald green in both light and dark modes)
  const resolvedDotColor = '#ffffff';

  const update = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Read sequence progress from parent overlay custom property
    const computed = getComputedStyle(container);
    const rawSeq = computed.getPropertyValue('--seq').trim();
    const seq = rawSeq ? Number.parseFloat(rawSeq) : 0;

    const span = Math.max(0.01, end - start);
    const p = Math.min(1, Math.max(0, (seq - start) / span));

    if (reducedMotion) {
      if (titleElRef.current) {
        titleElRef.current.textContent = p >= 0.5 ? flippedTitle : initialTitle;
      }
      if (subtitleElRef.current) {
        subtitleElRef.current.textContent = p >= 0.5 ? flippedSubtitle : initialSubtitle;
        subtitleElRef.current.style.opacity = '1';
      }
      return;
    }

    // Step 1: Initial state before pixel dissolve begins
    if (p <= 0.005) {
      if (titleElRef.current && titleElRef.current.textContent !== initialTitle) {
        titleElRef.current.textContent = initialTitle;
        titleElRef.current.style.opacity = '1';
      }
      if (subtitleElRef.current && subtitleElRef.current.textContent !== initialSubtitle) {
        subtitleElRef.current.textContent = initialSubtitle;
        subtitleElRef.current.style.opacity = '0.9';
      }
      dotElementsRef.current.forEach((el) => {
        if (el && el.dataset.active !== 'false') el.dataset.active = 'false';
      });
      return;
    }

    // Step 2: Phase 1 (0.005 to 0.48) - Pixel dots populate and dissolve "About Me"
    if (p < 0.48) {
      const p1 = p / 0.48; // 0 -> 1
      if (titleElRef.current) {
        if (titleElRef.current.textContent !== initialTitle) {
          titleElRef.current.textContent = initialTitle;
        }
        titleElRef.current.style.opacity = Math.max(0, 1 - p1 * 1.6).toFixed(2);
      }
      if (subtitleElRef.current) {
        if (subtitleElRef.current.textContent !== initialSubtitle) {
          subtitleElRef.current.textContent = initialSubtitle;
        }
        subtitleElRef.current.style.opacity = Math.max(0, 0.9 - p1 * 1.8).toFixed(2);
      }

      // Activate white pixel dots to cover and dissolve text
      const total = dots.length;
      for (let i = 0; i < total; i++) {
        const el = dotElementsRef.current[i];
        const dot = dots[i];
        if (!el || !dot) continue;
        const isActive = p1 >= dot.threshold;
        const activeStr = String(isActive);
        if (el.dataset.active !== activeStr) el.dataset.active = activeStr;
      }
      return;
    }

    // Step 3: Phase 2 (0.48 to 1.00) - "Education" is written and emerges within pixel dots
    const p2 = Math.min(1, Math.max(0, (p - 0.48) / 0.52)); // 0 -> 1

    if (titleElRef.current) {
      // Progressively write / reveal "Education" characters within the pixel dots
      const writeProgress = Math.min(1, p2 / 0.8);
      const numChars = Math.min(
        flippedTitle.length,
        Math.max(1, Math.ceil(writeProgress * flippedTitle.length))
      );
      const currentWritten = flippedTitle.slice(0, numChars);
      if (titleElRef.current.textContent !== currentWritten) {
        titleElRef.current.textContent = currentWritten;
      }
      titleElRef.current.style.opacity = Math.min(1, 0.4 + p2 * 0.6).toFixed(2);
    }

    if (subtitleElRef.current) {
      if (subtitleElRef.current.textContent !== flippedSubtitle) {
        subtitleElRef.current.textContent = flippedSubtitle;
      }
      subtitleElRef.current.style.opacity = Math.min(0.95, p2 * 1.8).toFixed(2);
    }

    // Pixel dots clear away left-to-right as "Education" is fully written
    const total = dots.length;
    for (let i = 0; i < total; i++) {
      const el = dotElementsRef.current[i];
      const dot = dots[i];
      if (!el || !dot) continue;
      // Dots clear as p2 exceeds threshold
      const isActive = p2 < 0.98 && p2 < dot.threshold;
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
