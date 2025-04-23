import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onMouseMove?: (e: React.MouseEvent) => void;
}

export const Card = ({ children, className = '', onMouseMove }: CardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const elements = useRef<HTMLElement[]>([]);
  const rafId = useRef<number>();

  useEffect(() => {
    if (cardRef.current) {
      elements.current = Array.from(
        cardRef.current.querySelectorAll('[data-interactive="true"]')
      );
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const updateElementStates = (x: number, y: number, rect: DOMRect) => {
    elements.current.forEach(element => {
      const elementRect = element.getBoundingClientRect();
      const elementCenterX = elementRect.left + elementRect.width / 2 - rect.left;
      const elementCenterY = elementRect.top + elementRect.height / 2 - rect.top;
      
      const distance = Math.hypot(x - elementCenterX, y - elementCenterY);
      const maxDistance = 150;
      const intensity = Math.max(0, 1 - (distance / maxDistance));
      const smoothedIntensity = intensity * intensity;
      
      element.style.setProperty('--intensity', smoothedIntensity.toString());
      element.setAttribute('data-lit', (smoothedIntensity > 0.1).toString());
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePosition.current = { x, y };
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;

    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }

    rafId.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      
      cardRef.current.style.setProperty('--mouse-x', `${x}px`);
      cardRef.current.style.setProperty('--mouse-y', `${y}px`);
      cardRef.current.style.setProperty('--rotate-x', `${rotateX}deg`);
      cardRef.current.style.setProperty('--rotate-y', `${rotateY}deg`);

      updateElementStates(x, y, rect);
    });

    onMouseMove?.(e);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;

    const resetAnimation = () => {
      if (!cardRef.current) return;

      cardRef.current.style.setProperty('--rotate-x', '0deg');
      cardRef.current.style.setProperty('--rotate-y', '0deg');

      elements.current.forEach(element => {
        element.style.setProperty('--intensity', '0');
        element.setAttribute('data-lit', 'false');
      });
    };

    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    rafId.current = requestAnimationFrame(resetAnimation);
  };

  return (
    <motion.div
      ref={cardRef}
      className={`${styles.card} ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1]
      }}
    >
      {children}
    </motion.div>
  );
}; 