import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Springs, getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { ArrowUpRight } from 'lucide-react';

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
  theme = 'dark',
  onClick,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const isLight = theme === 'light';

  const handleMouseMove = (e: React.MouseEvent) => {
    if (getPrefersReducedMotion()) return;
    if (!buttonRef.current) return;
    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = (e.clientX - centerX) * 0.35;
    const distanceY = (e.clientY - centerY) * 0.35;
    setPosition({ x: distanceX, y: distanceY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const variantStyles = {
    primary:
      'bg-emerald-500 hover:bg-emerald-400 text-black font-bold shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] border border-emerald-400/50',
    secondary: isLight
      ? 'bg-black/5 hover:bg-black/10 text-black border border-black/15'
      : 'bg-white/10 hover:bg-white/15 text-white border border-white/20 backdrop-blur-md',
    glass: isLight
      ? 'bg-white/70 hover:bg-white/90 text-neutral-900 border border-black/10 shadow-sm backdrop-blur-lg'
      : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-100 border border-white/10 backdrop-blur-lg shadow-xl',
  };

  const Component = href ? motion.a : motion.button;

  return (
    <Component
      ref={buttonRef as never}
      href={href}
      target={target}
      rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={Springs.snappy}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        'group relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-sm font-semibold tracking-wide transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer',
        variantStyles[variant],
        className
      )}
      {...(props as never)}
    >
      <span className="relative z-10 flex items-center gap-2">
        {children}
        {icon && (
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        )}
      </span>
    </Component>
  );
}
