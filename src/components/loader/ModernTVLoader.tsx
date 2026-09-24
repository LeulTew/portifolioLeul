import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeContext } from '../sections/theme/ThemeContext';
import { useAssetLoadingProgress } from './useAssetLoadingProgress';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import styles from './ModernTVLoader.module.css';

export interface ModernTVLoaderProps {
  onLoaded?: () => void;
  minDurationMs?: number;
  theme?: string;
  /** False when the page will open without a 3D scene; only DOM assets are then worth waiting for. */
  scene?: boolean;
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
const FRAME_MS = 1000 / 60;

export function ModernTVLoader({
  onLoaded,
  minDurationMs = 1800,
  theme: propTheme,
  scene = true,
}: ModernTVLoaderProps) {
  const context = useContext(ThemeContext);
  const resolvedTheme =
    propTheme ||
    context?.theme ||
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) ||
    'dark';
  const isLight = resolvedTheme === 'light';
  const reducedMotion = usePrefersReducedMotion();

  const [isCompleted, setIsCompleted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const currentProgressRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const { progress } = useAssetLoadingProgress({
    minDurationMs,
    scene,
    onComplete: () => {
      // Let the wave land, and let it be seen landing, before pulling away.
      holdTimerRef.current = setTimeout(() => setIsExiting(true), reducedMotion ? 0 : FULL_HOLD_MS);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    const logo = logoRef.current;
    if (!canvas || !logo || reducedMotion || isCompleted) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    let animatedProgress = currentProgressRef.current;
    let width = 0;
    let totalHeight = 0;
    let dpr = 1;
    let waveAmp = 45;
    let lastPaint: number | null = null;

    const measure = () => {
      width = logo.clientWidth || 960;
      waveAmp = window.innerWidth >= 1024 ? 45 : 24;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      totalHeight = (logo.clientHeight || 240) + 1.75 * waveAmp;
      // Canvas dimensions are integers. A fractional comparison resets the
      // entire bitmap on every frame even when the layout never changes.
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(totalHeight * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    };

    const paint = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, totalHeight);

      // Fraction: 1 (empty, wave at bottom) -> 0 (full, wave at top)
      const fraction = 1 - Math.min(Math.max(animatedProgress / 100, 0), 1);
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
    };

    const render = (now: number) => {
      animFrameRef.current = null;
      if (!isRunning || document.hidden) return;
      animFrameRef.current = requestAnimationFrame(render);
      const elapsed = lastPaint === null ? FRAME_MS : now - lastPaint;
      if (elapsed < FRAME_MS - 0.5) return;
      lastPaint = now;
      const step = Math.min(elapsed, 50) / FRAME_MS;
      animatedProgress += (currentProgressRef.current - animatedProgress) *
        (1 - (1 - WAVE_TRACKING) ** step);
      if (currentProgressRef.current >= 100 && animatedProgress > 99.5) animatedProgress = 100;
      phaseRef.current += 0.035 * step;
      paint();
    };

    const resize = () => { measure(); paint(); };
    const visibility = () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      lastPaint = null;
      if (!document.hidden && isRunning) animFrameRef.current = requestAnimationFrame(render);
    };
    measure();
    paint();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(logo);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    visibility();

    return () => {
      isRunning = false;
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isLight, reducedMotion, isCompleted]);

  // Handle zoom-expansion exit animation once loading completes
  const handleExitComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsCompleted(true);
    onLoaded?.();
  }, [onLoaded]);

  useEffect(() => {
    if (!isExiting) return;
    const exitTimer = setTimeout(() => {
      handleExitComplete();
    }, reducedMotion ? 200 : 900);
    return () => clearTimeout(exitTimer);
  }, [isExiting, handleExitComplete, reducedMotion]);

  if (isCompleted) {
    return null;
  }

  // Calculate dynamic scale factor to zoom past the camera edges on exit
  const scaleTarget = isExiting && !reducedMotion && typeof window !== 'undefined'
    ? Math.max((window.innerWidth / (logoRef.current?.offsetWidth || 760)) * 2.2, 3.2)
    : 1;

  return (
    <motion.div
      className={cn(styles.overlay, isLight && styles.overlayLight)}
      initial={{ opacity: 1 }}
      animate={isExiting ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: reducedMotion ? 0.16 : 0.7, ease: [0.76, 0, 0.24, 1], delay: reducedMotion ? 0 : 0.15 }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading portfolio"
      data-reduced-motion={reducedMotion || undefined}
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
            duration: reducedMotion ? 0.16 : 0.85,
            ease: [0.76, 0, 0.24, 1],
          }}
          onAnimationComplete={() => {
            if (isExiting) {
              handleExitComplete();
            }
          }}
        >
          <div className={styles.canvasWrapper}>
            {reducedMotion ? <div className={styles.staticFill}
              style={{ transform: `scaleY(${progress / 100})` }} aria-hidden="true" />
              : <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />}
          </div>
        </motion.div>
      </div>

      {/* Screen reader text only - no visible text or percentage */}
      <span className="sr-only">Leul</span>
    </motion.div>
  );
}

export default ModernTVLoader;
