import {
  createElement, useEffect, useRef,
  type ReactNode, type WheelEventHandler,
} from 'react';
import gsap from 'gsap';
import styles from './Skills.module.css';

// Application-scoped adaptations of React Bits SplitText and TiltedCard.
// Source and retained license: /licenses/react-bits.txt.
interface SkillTextProps {
  text: string;
  tag?: 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  animated: boolean;
}

export function SkillText({ text, tag = 'span', className, animated }: SkillTextProps) {
  // React-owned word masks need no font measurements or independent triggers.
  // They wrap naturally when the local font loads or the desktop is resized.
  const words = animated ? text.split(/(\s+)/).map((word, index) => (
    /^\s+$/.test(word) ? word : (
      <span className={styles.wordMask} aria-hidden="true" key={index}>
        <span className={styles.word} data-skill-word="">{word}</span>
      </span>
    )
  )) : text;
  return createElement(tag, { className, 'aria-label': animated ? text : undefined }, words);
}

interface TiltedInstrumentProps {
  children: ReactNode;
  enabled: boolean;
  onWheel?: WheelEventHandler<HTMLElement>;
}

export function TiltedInstrument({ children, enabled, onWheel }: TiltedInstrumentProps) {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const figure = ref.current;
    const object = innerRef.current;
    if (!enabled || !figure || !object ||
        document.documentElement.dataset.quality === 'low' ||
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let bounds: DOMRect | null = null;
    let rotateX: gsap.QuickToFunc;
    let rotateY: gsap.QuickToFunc;
    const context = gsap.context(() => {
      rotateX = gsap.quickTo(object, 'rotationX', { duration: 0.55, ease: 'power3.out' });
      rotateY = gsap.quickTo(object, 'rotationY', { duration: 0.55, ease: 'power3.out' });
    }, figure);
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') bounds = figure.getBoundingClientRect();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (!bounds) bounds = figure.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      rotateX(-y * 4);
      rotateY(x * 4);
    };
    const reset = () => {
      bounds = null;
      rotateX(0);
      rotateY(0);
    };
    figure.addEventListener('pointerenter', enter, { passive: true });
    figure.addEventListener('pointermove', move, { passive: true });
    figure.addEventListener('pointerleave', reset, { passive: true });
    window.addEventListener('resize', reset);

    return () => {
      figure.removeEventListener('pointerenter', enter);
      figure.removeEventListener('pointermove', move);
      figure.removeEventListener('pointerleave', reset);
      window.removeEventListener('resize', reset);
      context.revert();
    };
  }, [enabled]);

  return (
    <figure
      ref={ref}
      className={styles.instrument}
      onWheel={onWheel}
      aria-hidden="true"
    >
      <div ref={innerRef} className={styles.instrumentTilt}>
        {children}
      </div>
    </figure>
  );
}
