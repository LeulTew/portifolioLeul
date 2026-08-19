import { useEffect, useRef } from 'react';
import styles from './CursorGlow.module.css';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';

export const CursorGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        if (!glowRef.current) return;
        glowRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return <div ref={glowRef} className={styles.glow} />;
};