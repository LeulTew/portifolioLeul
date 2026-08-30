import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { DancingCharText, KineticRotator } from '../../ui/KineticText';
import styles from './Home.module.css';

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
}

export function Home({ onNavigate, theme = 'dark' }: HomeProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [inViewRatio, setInViewRatio] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInViewRatio(entry.intersectionRatio);
      },
      {
        threshold: Array.from({ length: 21 }, (_, i) => i / 20),
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Exit animation properties driven by scroll position
  const heroOpacity = inViewRatio < 0.05 ? 0 : inViewRatio;
  const heroScale = 0.92 + inViewRatio * 0.08;
  const heroY = (1 - inViewRatio) * -70;
  const heroBlur = (1 - inViewRatio) * 6;
  const isVisible = inViewRatio > 0.02;

  // A profile-image travel driven by viewport scrollY used to sit here. This
  // page scrolls inside the ScrollControls element, so that value never moved
  // and both transforms returned their constants forever. The hero exit is
  // driven by inViewRatio above, which does work.

  const scrollToAbout = () => {
    if (onNavigate) {
      onNavigate('about');
      return;
    }
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('about')?.scrollIntoView({ 
      behavior: prefersReduced ? 'auto' : 'smooth', 
      block: 'start' 
    });
  };

  const scrollToContact = () => {
    if (onNavigate) {
      onNavigate('contact');
      return;
    }
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('contact')?.scrollIntoView({ 
      behavior: prefersReduced ? 'auto' : 'smooth', 
      block: 'start' 
    });
  };

  return (
    <section ref={containerRef} className={styles.home} id="home">
      <div 
        className={styles.content}
        style={{
          opacity: heroOpacity,
          transform: `translate3d(0, ${heroY}px, 0) scale(${heroScale})`,
          filter: heroBlur > 0.1 ? `blur(${heroBlur}px)` : 'none',
          pointerEvents: isVisible ? 'auto' : 'none',
          visibility: isVisible ? 'visible' : 'hidden',
          transition: 'opacity 0.15s ease-out, transform 0.15s ease-out, filter 0.15s ease-out',
        }}
      >
        <motion.div 
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 1,
            ease: [0.76, 0, 0.24, 1],
            delay: 0.2
          }}
        >
          <motion.div 
            className={styles.imageContainer}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ 
              duration: 1,
              ease: [0.76, 0, 0.24, 1],
              delay: 0.1
            }}
          >
            <div className={styles.imagePlaceholder}>
              <span className={styles.circleText}>L</span>
              <img 
                src="/images/leul-profile.webp" 
                alt="Leul" 
                className={styles.circleImage}
              />
            </div>
          </motion.div>

          <motion.h1 
            className={styles.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 1,
              ease: [0.76, 0, 0.24, 1],
              delay: 0.3
            }}
          >
            <DancingCharText text="Leul" className="mr-3" />
            <DancingCharText text="Tewodros" className={styles.lastname} />
          </motion.h1>

          <motion.div 
            className={styles.info}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 1,
              ease: [0.76, 0, 0.24, 1],
              delay: 0.4
            }}
          >
            <span className="opacity-80">ARCHITECTING</span>
            <KineticRotator words={['FULL-STACK APPS', 'THREE.JS 3D EXPERIENCES', 'INTELLIGENT SYSTEMS', 'HIGH-PERFORMANCE UI']} />
          </motion.div>
        </motion.div>

        <motion.p 
          className={styles.description}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ 
            duration: 1,
            ease: [0.76, 0, 0.24, 1],
            delay: 0.5
          }}
        >
          Full-Stack Developer &amp; 3D Web Graphics Engineer crafting high-performance interactive applications, scalable distributed architectures, and award-winning digital experiences.
        </motion.p>

        {/* Magnetic CTA Buttons */}
        <motion.div
          className="flex flex-wrap items-center gap-4 mt-6 pointer-events-auto"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <MagneticButton onClick={scrollToAbout} variant="primary" theme={theme}>
            Explore My Work
          </MagneticButton>
          <MagneticButton onClick={scrollToContact} variant="secondary" icon={false} theme={theme}>
            Get In Touch
          </MagneticButton>
        </motion.div>
      </div>

      <motion.div 
        className={styles.profileImage}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          duration: 1,
          ease: [0.76, 0, 0.24, 1],
          delay: 0.2
        }}
      >
        <img src="/images/leul-profile.webp" alt="Leul" />
      </motion.div>

      <div 
        className={styles.scrollArrow}
        onClick={scrollToAbout}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            scrollToAbout();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Scroll to about section"
      >
        <div className={styles.curve} />
        <div className={styles.point} />
      </div>
    </section>
  );
}