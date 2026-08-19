import { useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Animation Gateway & Motion Coordinator
 * Unified bridge connecting Three.js, Framer Motion, GSAP, and Anime.js.
 */

export interface SpringConfig {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass?: number;
}

/**
 * Standardized Spring Presets (60fps optimized)
 */
export const Springs = {
  // Snappy spring for interactive buttons, tabs, toggles
  snappy: {
    type: 'spring',
    stiffness: 450,
    damping: 25,
    mass: 0.8,
  } as SpringConfig,

  // Smooth spring for card expansion, modals, layout morphing
  smooth: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 1,
  } as SpringConfig,

  // Gentle spring for camera pans and ambient floating
  gentle: {
    type: 'spring',
    stiffness: 120,
    damping: 20,
    mass: 1.2,
  } as SpringConfig,
};

/**
 * Standardized Easing Curves
 */
export const Easings = {
  easeOutCubic: [0.22, 1, 0.36, 1] as const,
  easeInOutQuart: [0.76, 0, 0.24, 1] as const,
  anticipate: [0.36, 0, 0.66, -0.56] as const,
};

/**
 * Check if the user prefers reduced motion (A11y safe synchronous check)
 */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * React hook for live reactive reduced motion preference changes
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => getPrefersReducedMotion());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (typeof (mediaQuery as { addListener?: (fn: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
      (mediaQuery as { addListener: (fn: (e: MediaQueryListEvent) => void) => void }).addListener(handleChange);
      return () => {
        (mediaQuery as { removeListener: (fn: (e: MediaQueryListEvent) => void) => void }).removeListener(handleChange);
      };
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Linear interpolation helper for 3D camera & particle coordinates
 */
export function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Clamps a number between minimum and maximum bounds
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a GSAP ScrollTrigger horizontal rail that scrubs indices on vertical scroll
 */
export function createHorizontalRailScrollTrigger(
  triggerElement: HTMLElement,
  totalItems: number,
  onProgress: (progress: number, activeIndex: number) => void
): ScrollTrigger | null {
  if (
    !triggerElement ||
    !triggerElement.parentNode ||
    typeof window === 'undefined' ||
    getPrefersReducedMotion() ||
    totalItems <= 1
  ) {
    return null;
  }

  const trigger = ScrollTrigger.create({
    trigger: triggerElement,
    start: 'top top',
    end: () => `+=${window.innerHeight * Math.min(totalItems * 0.5, 3)}`,
    pin: true,
    scrub: 1,
    anticipatePin: 1,
    onUpdate: (self) => {
      const progress = self.progress;
      const calculatedIndex = Math.min(
        Math.floor(progress * totalItems),
        totalItems - 1
      );
      onProgress(progress, calculatedIndex);
    },
  });

  return trigger;
}
