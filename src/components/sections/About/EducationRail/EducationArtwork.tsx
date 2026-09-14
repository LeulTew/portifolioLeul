import { useCallback, useEffect, useRef, type PointerEvent, type ReactNode, type WheelEvent } from 'react';
import { motion, useSpring } from 'framer-motion';
import styles from './EducationRail.module.css';

// Adapted from React Bits TiltedCard; see /licenses/react-bits.txt.
const SPRING = { damping: 30, stiffness: 220, mass: 0.7 };
const HOVER_MOTION = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

export function EducationArtwork({
  children,
  active,
  onWheel,
}: {
  children: ReactNode;
  active: boolean;
  onWheel: (event: WheelEvent) => void;
}) {
  const bounds = useRef<DOMRect | null>(null);
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const scale = useSpring(1, SPRING);

  const reset = useCallback((immediate = false) => {
    bounds.current = null;
    if (immediate) {
      rotateX.jump(0);
      rotateY.jump(0);
      scale.jump(1);
    } else {
      rotateX.set(0);
      rotateY.set(0);
      scale.set(1);
    }
  }, [rotateX, rotateY, scale]);

  useEffect(() => {
    if (!active) {
      reset(true);
      return;
    }
    const resized = () => reset(true);
    const visibility = () => { if (document.hidden) reset(true); };
    window.addEventListener('resize', resized);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('resize', resized);
      document.removeEventListener('visibilitychange', visibility);
      bounds.current = null;
      rotateX.stop();
      rotateY.stop();
      scale.stop();
    };
  }, [active, reset, rotateX, rotateY, scale]);

  const move = (event: PointerEvent<HTMLElement>) => {
    if (!active || event.pointerType !== 'mouse' || document.hidden) return;
    if (!bounds.current) {
      if (!window.matchMedia(HOVER_MOTION).matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      bounds.current = rect;
      scale.set(1.06);
    }
    const rect = bounds.current;
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    rotateX.set(Math.max(-1, Math.min(1, y)) * -14);
    rotateY.set(Math.max(-1, Math.min(1, x)) * 14);
  };

  return (
    <figure
      className={styles.markFigure}
      onPointerEnter={move}
      onPointerMove={move}
      onPointerLeave={() => reset()}
      onWheel={onWheel}
    >
      <motion.div className={styles.markTilt} style={{ rotateX, rotateY, scale }}>
        {children}
      </motion.div>
    </figure>
  );
}
