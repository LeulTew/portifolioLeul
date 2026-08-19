import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { MagneticButton } from '../../ui/MagneticButton';
import { DancingCharText, KineticRotator, TelemetryBadge } from '../../ui/KineticText';
import styles from './Home.module.css';

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
  theme?: string;
}

export function Home({ onNavigate, theme = 'dark' }: HomeProps) {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();

  const imageY = useTransform(scrollY, (value) => {
    if (typeof window === 'undefined') return 0;
    const aboutEl = document.getElementById('about');
    if (!aboutEl) return 0;
    const aboutTop = aboutEl.offsetTop;
    const aboutHeight = aboutEl.offsetHeight;
    const startMoving = 0;
    const stopMoving = aboutTop + (aboutHeight * 0.3);
    if (value < startMoving) return 0;
    if (value > stopMoving) return aboutTop - window.innerHeight / 2;
    const progress = (value - startMoving) / (stopMoving - startMoving);
    return progress * (aboutTop - window.innerHeight / 2);
  });

  const imageOpacity = useTransform(scrollY, (value) => {
    if (typeof window === 'undefined') return 1;
    const aboutEl = document.getElementById('about');
    if (!aboutEl) return 1;
    const aboutTop = aboutEl.offsetTop;
    const aboutHeight = aboutEl.offsetHeight;
    const startMoving = 0;
    const stopMoving = aboutTop + (aboutHeight * 0.3);
    if (value < startMoving) return 1;
    if (value > stopMoving) return 0;
    const progress = (value - startMoving) / (stopMoving - startMoving);
    return 1 - progress;
  });

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
      <div className={styles.content}>
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
          {/* Telemetry Badge Header */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <TelemetryBadge label="SYSTEM" value="ONLINE" theme={theme} />
            <TelemetryBadge label="FOCUS" value="FULL-STACK & 3D WEB" theme={theme} />
          </div>

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
          Full-Stack Developer & 3D Web Graphics Engineer crafting high-performance interactive applications, scalable distributed architectures, and award-winning digital experiences.
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
        style={{
          y: imageY,
          opacity: imageOpacity,
        }}
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