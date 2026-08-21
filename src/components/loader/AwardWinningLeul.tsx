import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import styles from './ModernTVLoader.module.css';

interface AwardWinningLeulProps {
  progress: number;
  theme?: string;
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.76, 0, 0.24, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: [0.76, 0, 0.24, 1],
    },
  },
};

export function AwardWinningLeul({ progress, theme = 'dark' }: AwardWinningLeulProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const currentProgressRef = useRef(progress);
  const phaseRef = useRef(0);
  const isLight = theme === 'light';

  // Keep target progress synchronized
  useEffect(() => {
    currentProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let animatedProgress = Math.min(Math.max(currentProgressRef.current, 0), 100);

    const render = () => {
      if (!isRunning) return;

      const targetProgress = Math.min(Math.max(currentProgressRef.current, 0), 100);
      // Smoothly interpolate towards target progress
      animatedProgress += (targetProgress - animatedProgress) * 0.12;

      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const width = canvas.offsetWidth || 600;
      const height = canvas.offsetHeight || 180;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const fraction = 1 - animatedProgress / 100;
      const waveAmplitude = width >= 600 ? 18 : 12;
      const totalHeight = height + waveAmplitude * 1.5;
      const baseY = totalHeight * fraction;

      phaseRef.current += 0.035;
      const m = phaseRef.current;

      // 1. Draw back ambient wave layer
      ctx.beginPath();
      ctx.fillStyle = isLight ? 'rgba(5, 150, 105, 0.35)' : 'rgba(0, 255, 157, 0.3)';
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 4) {
        const backY =
          (baseY + 6) -
          Math.sin(0.018 * x - m) * Math.cos(0.012 * x + m) * (waveAmplitude * 0.7);
        ctx.lineTo(x, backY);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // 2. Draw foreground luminous wave layer
      const gradient = ctx.createLinearGradient(0, height, width, 0);
      if (isLight) {
        gradient.addColorStop(0, '#047857');
        gradient.addColorStop(0.4, '#059669');
        gradient.addColorStop(0.75, '#10b981');
        gradient.addColorStop(1, '#34d399');
      } else {
        gradient.addColorStop(0, '#004325');
        gradient.addColorStop(0.35, '#00a862');
        gradient.addColorStop(0.75, '#00ff9d');
        gradient.addColorStop(1, '#ffffff');
      }

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 3) {
        // Multi-harmonic sine wave formulation inspired by NeoLeaf
        const waveY =
          baseY -
          Math.sin(0.02 * x + m) *
            Math.sin(0.01 * x + m) *
            Math.sin(0.05 * x + m) *
            waveAmplitude;
        ctx.lineTo(x, waveY);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // 3. Draw shimmering surface foam crest line
      ctx.beginPath();
      ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isLight ? 2 : 1.5;
      for (let x = 0; x <= width; x += 3) {
        const waveY =
          baseY -
          Math.sin(0.02 * x + m) *
            Math.sin(0.01 * x + m) *
            Math.sin(0.05 * x + m) *
            waveAmplitude;
        if (x === 0) {
          ctx.moveTo(x, waveY);
        } else {
          ctx.lineTo(x, waveY);
        }
      }
      ctx.stroke();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isLight]);

  return (
    <motion.div
      className={cn(styles.standbyCard, isLight && styles.standbyCardLight)}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className={styles.liquidContainer} role="img" aria-label="Leul">
        {/* Unfilled base text layer with subtle opacity */}
        <div className={cn(styles.unfilledText, isLight && styles.unfilledTextLight)}>
          LEUL
        </div>

        {/* Dynamic Multi-Harmonic Wave Fluid Canvas masked by the LEUL text */}
        <div className={styles.maskedCanvasWrapper}>
          <canvas ref={canvasRef} className={styles.fluidCanvas} />
        </div>

        {/* Accessible text for screen readers */}
        <span className="sr-only">Leul</span>
      </div>
    </motion.div>
  );
}
