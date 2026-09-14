import {
  createElement, useEffect, useRef, useState,
  type ReactNode, type WheelEventHandler,
} from 'react';
import gsap from 'gsap';
import type { SkillInlineMotion, SkillTextMotion } from './skillsData';
import styles from './Skills.module.css';

// Application-scoped React Bits adaptations. The shared score owns playback;
// no independent triggers, typing intervals, or perpetual cursor loops.
// Source and retained license: /licenses/react-bits.txt.
interface SkillTextProps {
  text: string;
  tag?: 'h2' | 'h3' | 'p' | 'span';
  className?: string;
  animated: boolean;
  mode?: SkillTextMotion;
}

export function SkillText({ text, tag = 'span', className, animated, mode = 'assemble' }: SkillTextProps) {
  const [economy] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.quality === 'low');
  const words = animated ? text.split(/(\s+)/).map((word, index) => {
    if (/^\s+$/.test(word)) return word;
    if (!economy && (mode === 'decode' || mode === 'draw')) {
      return <span className={styles.wordGroup} aria-hidden="true" key={index}>
        {Array.from(word).map((character, characterIndex) => (
          <span className={styles.charMask} key={characterIndex}>
            <span className={styles.char} data-skill-char=""
              data-cipher={mode === 'decode' ? (character.charCodeAt(0) + characterIndex) % 2 : undefined}>
              {character}
            </span>
          </span>
        ))}
      </span>;
    }
    return (
      <span className={`${styles.wordMask} ${mode === 'focus' ? styles.focusMask : ''}`}
        aria-hidden="true" key={index} data-skill-scan-window={mode === 'scan' ? '' : undefined}>
        <span className={styles.word}
          data-skill-word={mode !== 'scan' ? '' : undefined}
          data-skill-scan-text={mode === 'scan' ? '' : undefined}>{word}</span>
      </span>
    );
  }) : text;
  return createElement(tag, {
    className, 'aria-label': animated ? text : undefined, 'data-text-motion': animated ? mode : undefined,
    'data-text-quality': animated ? (economy ? 'economy' : 'full') : undefined,
  }, words);
}

export function SkillInlineText({ text, mode, animated }: {
  text: string;
  mode: SkillInlineMotion;
  animated: boolean;
}) {
  const [economy] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.quality === 'low');
  if (!animated) return <span>{text}</span>;
  if (economy) return <span data-inline-motion={mode} aria-hidden="true">{text}</span>;
  const characters = mode === 'decode' || mode === 'type';
  return <span className={styles.inlineText} data-inline-motion={mode} aria-hidden="true">
    {text.split(/(\s+)/).map((word, wordIndex) => {
      if (/^\s+$/.test(word)) return word;
      return <span className={styles.wordGroup} key={wordIndex}>
        {characters ? Array.from(word).map((character, index) => (
          <span className={mode === 'decode' ? styles.charMask : undefined} key={index}>
            <span className={`${styles.inlineUnit} ${styles.char}`} data-skill-inline-unit=""
              data-cipher={mode === 'decode' ? (character.charCodeAt(0) + index) % 2 : undefined}>
              {character}
            </span>
          </span>
        )) : <span className={styles.wordMask}>
          <span className={styles.inlineUnit} data-skill-inline-unit="">{word}</span>
        </span>}
      </span>;
    })}
    {mode === 'draw' && <svg className={styles.inlineRule} viewBox="0 0 100 2" preserveAspectRatio="none"
      aria-hidden="true" focusable="false">
      <path d="M0 1H100" pathLength={1} strokeDasharray="1" data-skill-inline-rule="" />
    </svg>}
  </span>;
}

interface TiltedInstrumentProps {
  children: ReactNode;
  enabled: boolean;
  interactive?: boolean;
  onWheel?: WheelEventHandler<HTMLElement>;
}

export function TiltedInstrument({ children, enabled, interactive = true, onWheel }: TiltedInstrumentProps) {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const interactiveRef = useRef(interactive);
  const resetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    interactiveRef.current = interactive;
    resetRef.current?.();
  }, [interactive]);

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
      if (interactiveRef.current && event.pointerType === 'mouse') bounds = figure.getBoundingClientRect();
    };
    const move = (event: PointerEvent) => {
      if (!interactiveRef.current || event.pointerType !== 'mouse') return;
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
    resetRef.current = reset;
    figure.addEventListener('pointerenter', enter, { passive: true });
    figure.addEventListener('pointermove', move, { passive: true });
    figure.addEventListener('pointerleave', reset, { passive: true });
    window.addEventListener('resize', reset);

    return () => {
      resetRef.current = null;
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
