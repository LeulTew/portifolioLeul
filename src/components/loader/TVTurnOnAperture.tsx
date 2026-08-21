import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { cn } from '@/lib/utils';
import { AwardWinningLeul } from './AwardWinningLeul';
import styles from './ModernTVLoader.module.css';

interface TVTurnOnApertureProps {
  onComplete: () => void;
  theme?: string;
}

export function TVTurnOnAperture({ onComplete, theme = 'dark' }: TVTurnOnApertureProps) {
  const prefersReduced = usePrefersReducedMotion();
  const isLight = theme === 'light';

  useEffect(() => {
    const duration = prefersReduced ? 350 : 880;
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [prefersReduced, onComplete]);

  if (prefersReduced) {
    return (
      <motion.div
        className={cn(styles.diagonalContainer, isLight && styles.screenOverlayLight)}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
      />
    );
  }

  return (
    <div className={styles.diagonalContainer} aria-hidden="true">
      {/* Top-Left Diagonal Shutter (Cuts diagonally from bottom-left to top-right and slides toward top-left) */}
      <motion.div
        className={cn(styles.topLeftDiagonalShutter, isLight && styles.topLeftDiagonalShutterLight)}
        initial={{ x: '0%', y: '0%' }}
        animate={{ x: '-100%', y: '-100%' }}
        transition={{
          duration: 0.85,
          ease: [0.76, 0, 0.24, 1],
        }}
      >
        <AwardWinningLeul progress={100} theme={theme} />
      </motion.div>

      {/* Bottom-Right Diagonal Shutter (Cuts diagonally from bottom-left to top-right and slides toward bottom-right) */}
      <motion.div
        className={cn(styles.bottomRightDiagonalShutter, isLight && styles.bottomRightDiagonalShutterLight)}
        initial={{ x: '0%', y: '0%' }}
        animate={{ x: '100%', y: '100%' }}
        transition={{
          duration: 0.85,
          ease: [0.76, 0, 0.24, 1],
        }}
      >
        <AwardWinningLeul progress={100} theme={theme} />
      </motion.div>
    </div>
  );
}
