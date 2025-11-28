import { useEffect, useState, useCallback, useRef, useLayoutEffect, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { Loader } from './components/Loader';
import { Navigation } from './components/Navigation';
import { Home } from './components/sections/Home/Home';
import { About } from './components/sections/About/About';
import { Projects } from './components/sections/Projects/Projects';
import { Skills } from './components/sections/Skills/Skills';
import { BackgroundScene } from './components/BackgroundScene';
import { Preload, ScrollControls, Scroll, useScroll } from '@react-three/drei';
import ParticleBackground from './components/ParticleBackground';
import { Contact } from './components/sections/Contact/Contact';
import { ThemeContext } from './components/sections/theme/ThemeContext';

import './index.css';
import styles from './App.module.css';
import './components/Arrow.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [scrollPages, setScrollPages] = useState(5.2);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useContext(ThemeContext);

  const handleScrollElement = useCallback((element: HTMLDivElement | null) => {
    setScrollElement(element);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const updateScrollPages = useCallback(() => {
    if (!mainRef.current) return;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || 1 : 1;
    const contentHeight = mainRef.current.scrollHeight || viewportHeight;
    const calculatedPages = Math.max(contentHeight / viewportHeight, 1.2);

    setScrollPages(prev => Math.abs(prev - calculatedPages) > 0.05 ? calculatedPages : prev);
  }, []);

  useLayoutEffect(() => {
    if (isLoading) return;
    updateScrollPages();

    const mainElement = mainRef.current;
    if (!mainElement) return;

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateScrollPages())
      : null;

    observer?.observe(mainElement);
    window.addEventListener('resize', updateScrollPages);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollPages);
    };
  }, [isLoading, updateScrollPages]);

  const scrollToSection = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) return;

    if (scrollElement && mainRef.current) {
      const container = scrollElement;
      const main = mainRef.current;
      const containerScrollable = Math.max(container.scrollHeight - container.clientHeight, 1);
      const contentScrollable = Math.max(main.scrollHeight - container.clientHeight, 1);
      const rawOffset = id === 'home' ? 0 : target.offsetTop - (main.offsetTop || 0);
      const adjustedOffset = Math.max(rawOffset - (id === 'home' ? 0 : 80), 0);
      const ratio = Math.min(1, Math.max(0, adjustedOffset / contentScrollable));

      container.scrollTo({
        top: ratio * containerScrollable,
        behavior: 'smooth'
      });
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollElement]);

  return (
    <div className={styles.container}>
      <Navigation scrollToSection={scrollToSection} />
      <Canvas
        dpr={[1, 1.5]}
        camera={{
          position: [0, 0, 10],
          fov: 50,
          near: 0.1,
          far: 100
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
      >
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
          <ScrollControls pages={scrollPages} damping={0.3} distance={1}>
            <ScrollManager onReady={handleScrollElement} />
            <BackgroundScene theme={theme} />
            <ParticleBackground theme={theme} />
            <Scroll html style={{ width: '100%' }}>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <Loader key="loader" />
                ) : (
                  <main ref={mainRef} className={styles.main}>
                    <Home onNavigate={scrollToSection} />
                    <div id="homeToAboutArrow" onClick={() => scrollToSection('about')}>
                      <div className="curveWrapper">
                        <div className="curve"></div>
                      </div>
                      <div className="point"></div>
                    </div>
                    <About />
                    <Skills />
                    <Projects theme={theme} />
                    <div className={styles.spacer} />
                    <Contact />
                  </main>
                )}
              </AnimatePresence>
            </Scroll>
          </ScrollControls>
          <Preload all />
        </ThemeContext.Provider>
      </Canvas>
      {!isLoading && (
        <motion.div 
          className={styles.footer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            duration: 1,
            ease: [0.76, 0, 0.24, 1],
            delay: 0.4
          }}
        >
          <div className={styles.scroll}>
            <div className={styles.scrollText}>Scroll to explore</div>
            <div className={styles.scrollLine} />
          </div>
          <div className={styles.year}>© {new Date().getFullYear()}</div>
        </motion.div>
      )}
    </div>
  );
}

export default App;

function ScrollManager({ onReady }: { onReady: (el: HTMLDivElement | null) => void }) {
  const scroll = useScroll();

  useEffect(() => {
    onReady(scroll?.el ?? null);
    return () => onReady(null);
  }, [scroll, onReady]);

  return null;
}