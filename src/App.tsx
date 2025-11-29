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
  const [scrollPages, setScrollPages] = useState(() => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width <= 380) {
        console.log('SETTING SCROLL PAGES TO 11 for narrow mobile, width:', width);
        return 11; // Narrow mobile - needs more scroll
      } else if (width < 768) {
        console.log('SETTING SCROLL PAGES TO 8.5 for mobile, width:', width);
        return 8.5; // Standard Mobile
      } else if (width >= 768 && width <= 1366) {
        console.log('SETTING SCROLL PAGES TO 9.5 for 720p, width:', width);
        return 9.5; // 720p - needs more scroll
      } else if (width > 1366 && width < 2000) {
        console.log('SETTING SCROLL PAGES TO 6.5 for 1080p, width:', width);
        return 6.5; // 1080p
      }
    }
    return 5.2; // 1440p+
  });
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
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth || 1 : 1;
    const isMobile = viewportWidth < 768;
    const is720p = viewportWidth >= 768 && viewportWidth <= 1366;
    const is1080p = viewportWidth > 1366 && viewportWidth < 2000;
    
    const contentHeight = mainRef.current.scrollHeight || viewportHeight;
    // Add extra buffer for mobile and standard desktop to ensure we reach the end
    // CHANGE THESE VALUES TO ADJUST SCROLL LENGTH:
    // Mobile (< 768px): 3.2
    // 720p (768px - 1366px): Increased to 16.5 to accommodate larger spacing
    // 1080p (1367px - 2000px): 15.0
    // Large Screens (>= 2000px): 0
    
    let extraBuffer = 0;
    if (isMobile) extraBuffer = 3.2;
    else if (is720p) extraBuffer = 16.5; // Increased for 720p
    else if (is1080p) extraBuffer = 15.0;
    
    const calculatedPages = Math.max(contentHeight / viewportHeight, 1.2) + extraBuffer;

    // Increased threshold to 0.5 to prevent re-renders on small content changes (like card expansion)
    const shouldUpdate = Math.abs(scrollPages - calculatedPages) > 0.5;
    
    // DEBUG: Log scroll calculation
    console.log('=== SCROLL DEBUG ===', {
      viewportWidth,
      viewportHeight,
      contentHeight,
      isMobile,
      is720p,
      is1080p,
      extraBuffer,
      calculatedPages,
      currentScrollPages: scrollPages,
      shouldUpdate
    });

    if (shouldUpdate) {
      setScrollPages(calculatedPages);
    }
  }, [scrollPages]);

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
          <ScrollControls pages={scrollPages} damping={0.3}>
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