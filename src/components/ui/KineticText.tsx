import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Springs, Easings, getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

interface KineticHeadingProps {
  text: string;
  className?: string;
  highlightWords?: string[];
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'div';
}

export function KineticHeading({
  text,
  className,
  highlightWords = [],
  delay = 0,
  as: Component = 'h1',
}: KineticHeadingProps) {
  const words = text.split(' ');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: delay,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 25,
      rotateX: -30,
      filter: 'blur(6px)',
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      filter: 'blur(0px)',
      transition: {
        duration: 0.7,
        ease: Easings.easeOutCubic,
      },
    },
  };

  const Tag = Component || 'h1';
  const MotionSpan = (motion && motion.span) ? motion.span : 'span';

  return (
    <Tag className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1', className)} aria-label={text}>
      <MotionSpan
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-20px' }}
        className="flex flex-wrap items-baseline gap-x-2"
      >
        {words.map((word, idx) => {
          const isHighlight = highlightWords.some(
            (hw) => hw.toLowerCase() === word.toLowerCase()
          );

          return (
            <MotionSpan
              key={idx}
              variants={wordVariants}
              className={cn(
                'inline-block tracking-tight',
                isHighlight ? 'text-emerald-400 font-bold drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]' : ''
              )}
            >
              {word}
            </MotionSpan>
          );
        })}
      </MotionSpan>
    </Tag>
  );
}

interface DancingCharTextProps {
  text: string;
  className?: string;
  delay?: number;
  highlightIndices?: number[];
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'div';
}

export function DancingCharText({
  text,
  className,
  delay = 0,
  as: Component = 'span',
}: DancingCharTextProps) {
  const characters = Array.from(text);
  const Tag = Component || 'span';
  const prefersReduced = getPrefersReducedMotion();

  return (
    <Tag
      className={cn('inline-flex flex-wrap items-baseline tracking-normal', className)}
      aria-label={text}
    >
      {characters.map((char, index) => {
        if (char === ' ') {
          return <span key={index} className="inline-block w-2" aria-hidden="true">&nbsp;</span>;
        }

        if (prefersReduced) {
          return (
            <span key={index} className="inline-block">
              {char}
            </span>
          );
        }

        /*
         * Each character rises out from behind its own clipping edge rather
         * than fading in place. The mask is the point: letters are uncovered,
         * which reads as typesetting rather than as elements arriving.
         *
         * The padding/negative-margin pair keeps descenders (g, y, p) from
         * being cropped by that same edge.
         */
        return (
          <span
            key={index}
            className="inline-block overflow-hidden align-bottom pb-[0.14em] mb-[-0.14em]"
            aria-hidden="true"
          >
            <motion.span
              className="inline-block cursor-default select-none will-change-transform hover:text-[#00ff9d] transition-colors duration-200"
              initial={{ y: '115%', rotate: -6, opacity: 0 }}
              animate={{ y: '0%', rotate: 0, opacity: 1 }}
              whileHover={{
                y: -8,
                rotate: index % 2 === 0 ? 12 : -12,
                scale: 1.15,
                transition: Springs.snappy,
              }}
              transition={{
                duration: 0.85,
                // Eases out along the word, so the tail settles rather than
                // marching at a fixed interval.
                delay: delay + Math.pow(index, 0.82) * 0.045,
                ease: Easings.easeOutExpo,
              }}
            >
              {char}
            </motion.span>
          </span>
        );
      })}
    </Tag>
  );
}

interface KineticRotatorProps {
  words: string[];
  className?: string;
  interval?: number;
}

export function KineticRotator({
  words,
  className,
  interval = 3000,
}: KineticRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <div className={cn('relative inline-flex overflow-hidden h-[1.3em] align-baseline', className)}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
          transition={Springs.smooth}
          className="inline-block font-mono font-bold text-emerald-400"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
