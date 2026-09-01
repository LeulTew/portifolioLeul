import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeContext } from '../sections/theme/ThemeContext';
import { useAssetLoadingProgress } from './useAssetLoadingProgress';
import styles from './ModernTVLoader.module.css';

export interface ModernTVLoaderProps {
  onLoaded?: () => void;
  minDurationMs?: number;
  theme?: string;
}

/**
 * How closely the drawn wave chases the fill, per frame at 60fps.
 *
 * The fill it is given is already eased. Easing it a second time here, as this
 * did, stacks two lags: the water was still climbing the letters when the
 * loader decided it was finished, so the exit began over a half-full LEUL and
 * the fill was never actually seen to complete.
 */
const WAVE_TRACKING = 0.3;

/**
 * How long the full letters hold before the exit begins, in milliseconds.
 *
 * The fill is the whole animation, and an exit that starts the instant it
 * lands throws it away at its resolution. A beat of stillness is what makes it
 * read as arriving rather than as being cut off.
 */
const FULL_HOLD_MS = 320;

export function ModernTVLoader({ onLoaded, minDurationMs = 1800, theme: propTheme }: ModernTVLoaderProps) {
  const context = useContext(ThemeContext);
  const resolvedTheme =
    propTheme ||
    context?.theme ||
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) ||
    'dark';
  const isLight = resolvedTheme === 'light';

  const [isCompleted, setIsCompleted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const currentProgressRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { progress } = useAssetLoadingProgress({
    minDurationMs,
    onComplete: () => {
      // Let the wave land, and let it be seen landing, before pulling away.
      holdTimerRef.current = setTimeout(() => setIsExiting(true), FULL_HOLD_MS);
    },
  });

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    []
  );

  useEffect(() => {
    currentProgressRef.current = progress;
  }, [progress]);

  // Continuous 60fps multi-harmonic fluid wave loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let animatedProgress = 0;

    const render = () => {
      if (!isRunning) return;

      const target = currentProgressRef.current;
      animatedProgress += (target - animatedProgress) * WAVE_TRACKING;
      // Otherwise the crest asymptotes just short of the top and the last
      // sliver of the letters never fills.
      if (target >= 100 && animatedProgress > 99.5) animatedProgress = 100;

      const width = canvas.offsetWidth || 960;
      const isLg = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const waveAmp = isLg ? 45 : 24;
      const totalHeight = (canvas.offsetHeight || 240) + 1.75 * waveAmp;

      if (canvas.width !== width * dpr || canvas.height !== totalHeight * dpr) {
        canvas.width = width * dpr;
        canvas.height = totalHeight * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${totalHeight}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, totalHeight);

      // Fraction: 1 (empty, wave at bottom) -> 0 (full, wave at top)
      const fraction = 1 - Math.min(Math.max(animatedProgress / 100, 0), 1);
      phaseRef.current += 0.035;
      const m = phaseRef.current;

      // Draw multi-harmonic liquid wave fill (exact formulation from NeoLeaf)
      ctx.beginPath();
      ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.moveTo(0, totalHeight);

      for (let x = 0; x <= width; x += 2) {
        const y =
          totalHeight * fraction -
          Math.sin(0.02 * x + m) *
            Math.sin(0.01 * x + m) *
            Math.sin(0.05 * x + m) *
            waveAmp;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, totalHeight);
      ctx.lineTo(0, totalHeight);
      ctx.closePath();
      ctx.fill();

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

  // Handle zoom-expansion exit animation once loading completes
  const handleExitComplete = useCallback(() => {
    setIsCompleted(true);
    onLoaded?.();
  }, [onLoaded]);

  useEffect(() => {
    if (!isExiting) return;
    const exitTimer = setTimeout(() => {
      handleExitComplete();
    }, 900);
    return () => clearTimeout(exitTimer);
  }, [isExiting, handleExitComplete]);

  if (isCompleted) {
    return null;
  }

  // Calculate dynamic scale factor to zoom past the camera edges on exit
  const scaleTarget = typeof window !== 'undefined'
    ? Math.max((window.innerWidth / (logoRef.current?.offsetWidth || 760)) * 2.2, 3.2)
    : 3.2;

  return (
    <motion.div
      className={cn(styles.overlay, isLight && styles.overlayLight)}
      initial={{ opacity: 1 }}
      animate={isExiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading portfolio"
    >
      <div className={styles.centerWrapper}>
        <motion.div
          ref={logoRef}
          className={cn(styles.logoMask, isLight && styles.logoMaskLight)}
          initial={{ scale: 1, opacity: 1 }}
          animate={
            isExiting
              ? {
                  scale: scaleTarget,
                  opacity: 0,
                  backgroundColor: isLight ? '#0f172a' : '#ffffff',
                }
              : {
                  scale: 1,
                  opacity: 1,
                }
          }
          transition={{
            duration: 0.85,
            ease: [0.76, 0, 0.24, 1],
          }}
          onAnimationComplete={() => {
            if (isExiting) {
              handleExitComplete();
            }
          }}
        >
          <div className={styles.canvasWrapper}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </motion.div>
      </div>

      {/* Screen reader text only - no visible text or percentage */}
      <span className="sr-only">Leul</span>
    </motion.div>
  );
}

export default ModernTVLoader;
