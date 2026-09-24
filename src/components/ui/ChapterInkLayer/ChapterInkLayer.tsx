import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { registerChapterInkLayer } from '@/lib/scroll/chapterInk';
import styles from './ChapterInkLayer.module.css';

export function ChapterInkLayer({ children, className = '' }: {
  children: ReactNode;
  className?: string;
}) {
  const layer = useRef<HTMLDivElement>(null);
  // The ink is written on this layer, not the root, so a change restyles only the painted copy.
  useLayoutEffect(() => (layer.current ? registerChapterInkLayer(layer.current) : undefined), []);
  return createPortal(
    <div ref={layer} className={`${styles.paint} ${className}`} aria-hidden="true" data-chapter-ink-layer="">
      {children}
    </div>,
    document.body
  );
}

/** Generated text keeps the second paint out of the document's readable copy. */
export function InkLabel({ text, painted }: { text: string; painted: boolean }) {
  return painted ? <span className={styles.label} data-ink-text={text} /> : <>{text}</>;
}
