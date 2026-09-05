import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Springs, getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { soundFx } from '@/lib/gateways/soundFx';
import { ArrowUpRight } from 'lucide-react';
import styles from './MagneticButton.module.css';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'glass';
  icon?: boolean;
  href?: string;
  target?: string;
  className?: string;
  theme?: string;
}

export function MagneticButton({
  children,
  variant = 'primary',
  icon = true,
  href,
  target,
  className,
  theme = 'light',
  onClick,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const isLight = theme === 'light';

  const handleMouseEnter = () => {
    soundFx.playMagneticSnap();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (getPrefersReducedMotion()) return;
    if (!buttonRef.current) return;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = (e.clientX - centerX) * 0.35;
    const distanceY = (e.clientY - centerY) * 0.35;
    setPosition({ x: distanceX, y: distanceY });
    setCursorPos({
      x: e.clientX - left,
      y: e.clientY - top,
      visible: true,
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setCursorPos((prev) => ({ ...prev, visible: false }));
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    soundFx.playLaserClick();
    onClick?.(e);
  };

  const getVariantClass = () => {
    if (variant === 'primary') return styles.primary;
    if (variant === 'secondary') return isLight ? styles.secondaryLight : styles.secondaryDark;
    return isLight ? styles.glassLight : styles.glassDark;
  };

  const Component = href ? motion.a : motion.button;

  return (
    <Component
      ref={buttonRef as never}
      href={href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={Springs.snappy}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick as never}
      className={cn(styles.magneticWrapper, className)}
      {...(props as Record<string, unknown>)}
    >
      <div className={cn(styles.cutoutFrame, getVariantClass())}>
        {/* Dynamic SVG Cyber Cutout Border */}
        <svg className={styles.borderSvg} preserveAspectRatio="none">
          <rect
            x="1"
            y="1"
            className={styles.borderPath}
          />
          <rect
            x="1"
            y="1"
            className={styles.tracerBeam}
          />
        </svg>

        {/* Localized Cursor Glow Spotlight */}
        {cursorPos.visible && (
          <div
            className={styles.cursorGlowSpot}
            style={{
              left: `${cursorPos.x}px`,
              top: `${cursorPos.y}px`,
            }}
          />
        )}

        {/* Technical Corner Brackets */}
        <span className={styles.cornerAccentTL} />
        <span className={styles.cornerAccentBR} />

        {/* Label & Kinetic Icon */}
        <span className={styles.labelContent}>
          {children}
          {icon && (
            <motion.span
              className="inline-flex"
              whileHover={{ rotate: 45, x: 2, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <ArrowUpRight className="h-4 w-4" />
            </motion.span>
          )}
        </span>
      </div>
    </Component>
  );
}
