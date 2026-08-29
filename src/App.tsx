import { useEffect, useState, useCallback, useRef, useLayoutEffect, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { ErrorBoundary } from 'react-error-boundary';
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
import { useGpuTier } from './lib/gateways/gpuTier';
import { setScrollProgress } from './lib/scroll/scrollProgress';

import './index.css';
import styles from './App.module.css';
import './components/Arrow.css';

/** Page-count churn below this is ignored, so card expansions don't retrigger layout. */
const SCROLL_PAGE_EPSILON = 0.05;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [scrollPages, setScrollPages] = useState(1);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const gpuConfig = useGpuTier();


  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const ua = navigator.userAgent;

    // Standard way to distinguish Android Phone vs Tablet: Phones have "Mobile" in UA
    const isMobile = /Mobi/i.test(ua);
    
    // Refined Tablet detection: 
    // 1. Explicit Tablet/iPad check
    // 2. Large screen AND NOT "Mobi" (prevents landscape phones from being detected as tablets)
    const isTablet = /Tablet|iPad/i.test(ua) || (window.innerWidth > 768 && !isMobile);

    // Redirect mobile phones
    if (isMobile && !isTablet) {
      window.location.href = 'https://portifolio-x-leul.vercel.app';
      return;
    }

    // Static mode for Tablets only if needed, but previously logic targeted phones.
    // Since phones are redirected, we might not need static mode for them.
    // Keeping logic simple: If not phone, we render normal content.
  }, []);

  const handleScrollElement = useCallback((element: HTMLDivElement | null) => {
    setScrollElement(element);
  }, []);

  useEffect(() => {
    // Safety fallback timeout to prevent infinite loading on network stall
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const updateScrollPages = useCallback(() => {
    if (!mainRef.current) return;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || 1 : 1;
    const contentHeight = mainRef.current.scrollHeight || viewportHeight;

    // ScrollControls translates the html layer by -(pages - 1) * viewportHeight
    // across the full scroll, so pages === contentHeight / viewportHeight maps
    // the content 1:1 onto the scroll track. Every section stays reachable and
    // the track ends exactly where the content does, with no dead scroll.
    const calculatedPages = Math.max(contentHeight / viewportHeight, 1);

    setScrollPages((previous) =>
      Math.abs(previous - calculatedPages) > SCROLL_PAGE_EPSILON ? calculatedPages : previous
    );
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
      <AnimatePresence>
        {isLoading && (
          <Loader key="loader" theme={theme} onLoaded={() => setIsLoading(false)} />
        )}
      </AnimatePresence>

      {!isLoading && (
        <Navigation scrollToSection={scrollToSection} />
      )}

      <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Canvas
            dpr={gpuConfig.dpr}
            camera={{
              position: [0, 0, 10],
              fov: 50,
              near: 0.1,
              far: 100
            }}
            gl={{
              antialias: gpuConfig.tier !== 'low',
              alpha: true,
              powerPreference: 'high-performance',
              stencil: false,
              depth: true,
            }}
          >
            <ThemeContext.Provider value={{ theme, toggleTheme }}>
              <ScrollControls pages={scrollPages} damping={0.3}>
                <ScrollManager onReady={handleScrollElement} />
                <BackgroundScene theme={theme} particleCount={gpuConfig.particleCount} />
                <ParticleBackground theme={theme} />
                <Scroll html style={{ width: '100%' }}>
                  {!isLoading && (
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
                </Scroll>
              </ScrollControls>
              <Preload all />
            </ThemeContext.Provider>
          </Canvas>
        


      </ErrorBoundary>

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
  }, [scroll?.el, onReady]);

  // The page scrolls inside the ScrollControls element, so this is the only
  // place that knows the real progress. Publish it for the DOM layer.
  useFrame(() => {
    setScrollProgress(scroll?.offset ?? 0);
  });

  return null;
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    }}>
      <h2>Something went wrong</h2>
      <p>Please refresh the page or try on a different device.</p>
      <details style={{ whiteSpace: 'pre-wrap' }}>
        {error.message}
      </details>
    </div>
  );
}
