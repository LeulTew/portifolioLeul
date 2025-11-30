import { useEffect, useState, useCallback, useRef, useLayoutEffect, useContext } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
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
  
  const isIPhone = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent);

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
    if (isMobile) extraBuffer = 5.0; // Increased from 3.2 to fix iPhone scroll truncation
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
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        {isIPhone ? (
          <div 
            className={styles.staticBackground}
            style={{
              background: theme === 'light' 
                ? 'linear-gradient(to bottom, #f4f7ff 0%, #e9e2d4 100%)' 
                : 'linear-gradient(to bottom, #001a1a 0%, #004428 100%)',
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: -1,
              transition: 'background 0.5s ease-in-out'
            }}
          />
        ) : (
          <Canvas
            dpr={[1, typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 1.5]}
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
        )}
        
        {/* For iPhone, we need to render the content outside the Canvas ScrollControls */}
        {isIPhone && !isLoading && (
           <div className={styles.iphoneScrollContainer} style={{ overflowY: 'auto', height: '100vh', scrollBehavior: 'smooth' }}>
              <main ref={mainRef} className={styles.main}>
                 <div className={styles.iphoneHome}>
                   <Home onNavigate={scrollToSection} />
                 </div>
                <div 
                  id="homeToAboutArrow" 
                  className={isIPhone ? styles.iphoneArrow : undefined}
                  onClick={() => scrollToSection('about')}
                >
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
          </div>
        )}
      </ErrorBoundary>
      <DesktopExperiencePopup />
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

function DesktopExperiencePopup() {
  const [isVisible, setIsVisible] = useState(false);
  const isIPhone = typeof navigator !== 'undefined' && /iPhone/i.test(navigator.userAgent);

  useEffect(() => {
    if (isIPhone) {
      const hasSeenPopup = localStorage.getItem('hasSeenDesktopPopup');
      if (!hasSeenPopup) {
        // Small delay to show after load
        const timer = setTimeout(() => setIsVisible(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isIPhone]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('hasSeenDesktopPopup', 'true');
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        right: '20px',
        background: 'rgba(20, 20, 20, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '20px',
        borderRadius: '16px',
        zIndex: 10000,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: '15px' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '10px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '16px', fontWeight: 600 }}>Best on Desktop</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '14px', lineHeight: '1.4' }}>
            This portfolio features a rich 3D experience that really shines on a larger screen. You can still browse here, but we recommend visiting on a computer for the full journey.
          </p>
        </div>
      </div>
      <button 
        onClick={handleDismiss}
        style={{
          background: 'white',
          color: 'black',
          border: 'none',
          padding: '12px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: '4px'
        }}
      >
        Got it, thanks
      </button>
    </motion.div>
  );
}