import { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import styles from './Home.module.css';

interface HomeProps {
  onNavigate?: (sectionId: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const containerRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    aboutRef.current = document.getElementById('about');
  }, []);

  // Use scroll progress relative to the viewport
  const { scrollY } = useScroll();

  // Transform values for the image
  const imageY = useTransform(scrollY, (value) => {
    if (typeof window === 'undefined' || !aboutRef.current) return 0;
    
    // Get About section position
    const aboutTop = aboutRef.current.offsetTop;
    const aboutHeight = aboutRef.current.offsetHeight;
    
    // Calculate distances
    const startMoving = 0; // Start from top of page
    const stopMoving = aboutTop + (aboutHeight * 0.3); // Stop at 30% into About section
    
    // If before start or after end, maintain position
    if (value < startMoving) return 0;
    if (value > stopMoving) return aboutTop - window.innerHeight/2;
    
    // Calculate progress
    const progress = (value - startMoving) / (stopMoving - startMoving);
    return progress * (aboutTop - window.innerHeight/2);
  });

  const imageOpacity = useTransform(scrollY, (value) => {
    if (typeof window === 'undefined' || !aboutRef.current) return 1;
    
    // Get About section position
    const aboutTop = aboutRef.current.offsetTop;
    const aboutHeight = aboutRef.current.offsetHeight;
    
    // Calculate distances
    const startMoving = 0; // Start from top of page
    const stopMoving = aboutTop + (aboutHeight * 0.3); // Stop at 30% into About section
    
    // If before start or after end, maintain position
    if (value < startMoving) return 1;
    if (value > stopMoving) return 0;
    
    // Calculate progress
    const progress = (value - startMoving) / (stopMoving - startMoving);
    return 1 - progress;
  });

  const scrollToAbout = () => {
    if (onNavigate) {
      onNavigate('about');
      return;
    }

    aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section ref={containerRef} className={styles.home} id="home">
      <motion.div className={styles.content}>
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
              <span>L</span>
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
            <span>Leul</span>
            <span className={styles.lastname}>Tewodros</span>
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
            <span>Motivated Computer Science Student</span>
            <span className={styles.divider}>/</span>
            <span>Aspiring Software Developer</span>
            <span className={styles.divider}>/</span>
            <span>Creative Problem Solver</span>
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
          Motivated Computer Science student at HiLCoE School of Computer Science & Technology, 
          with hands-on experience in software development and digital design. 
          Eager to contribute to impactful projects while gaining industry experience.
        </motion.p>
      </motion.div>

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
        <img src="/images/leul-profile.png" alt="Leul" />
      </motion.div>

      <div 
        className={styles.scrollArrow}
        onClick={scrollToAbout}
      >
        <div className={styles.curve}></div>
        <div className={styles.point}></div>
      </div>
    </section>
  );
} 