import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { writeStyleProperty } from '@/lib/dom/cachedElement';
import styles from './About.module.css';

const PLANES = [0, 1, 2, 3] as const;

export function StatementMorph({ side }: { side: 'left' | 'right' }) {
  const ref = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const column = ref.current?.parentElement;
    if (!column) return;

    const properties = ['--seed-scale-x', '--seed-scale-y', '--seed-inset-x', '--seed-inset-y'];
    const previous = properties.map(property => column.style.getPropertyValue(property));
    const measure = () => {
      const width = column.clientWidth;
      const height = column.clientHeight;
      if (width === 0 || height === 0) return;

      const seed = Math.min(320, window.innerHeight * 0.34, width * 0.72);
      writeStyleProperty(column, '--seed-scale-x', (seed / width).toFixed(5));
      writeStyleProperty(column, '--seed-scale-y', (seed / height).toFixed(5));
      writeStyleProperty(column, '--seed-inset-x', `${width - seed}px`);
      writeStyleProperty(column, '--seed-inset-y', `${(height - seed) / 2}px`);
    };

    // Only layout changes measure the copy; the existing statement clock owns every frame.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(column);
    window.addEventListener('resize', measure);
    measure();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      properties.forEach((property, index) => {
        if (previous[index]) column.style.setProperty(property, previous[index]);
        else column.style.removeProperty(property);
      });
    };
  }, []);

  return (
    <svg
      ref={ref}
      className={styles.statementMorph}
      data-statement-morph={side}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      {PLANES.map(index => (
        <rect
          key={index}
          className={styles.morphPlane}
          data-morph-plane=""
          style={{ '--plane-index': index } as CSSProperties}
          x="0"
          y="0"
          width="100"
          height="100"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path className={styles.morphHorizon} d="M-6 50H106" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
