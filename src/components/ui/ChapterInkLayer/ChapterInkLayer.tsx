import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ChapterInkLayer.module.css';

export function ChapterInkLayer({ children, className = '' }: {
  children: ReactNode;
  className?: string;
}) {
  return createPortal(
    <div className={`${styles.paint} ${className}`} aria-hidden="true" data-chapter-ink-layer="">
      {children}
    </div>,
    document.body
  );
}

/** Generated text keeps the second paint out of the document's readable copy. */
export function InkLabel({ text, painted }: { text: string; painted: boolean }) {
  return painted ? <span className={styles.label} data-ink-text={text} /> : <>{text}</>;
}
