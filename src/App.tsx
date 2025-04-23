import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { ThemeProvider } from './components/sections/theme/ThemeProvider';
import { Loader } from './components/Loader';
import { Navigation } from './components/Navigation';
import { Home } from './components/sections/Home/Home';
import { About } from './components/sections/About/About';
import { Projects } from './components/sections/Projects/Projects';
import { Skills } from './components/sections/Skills/Skills';
import { BackgroundScene } from './components/BackgroundScene';
import { Preload, ScrollControls, Scroll } from '@react-three/drei';
import { useLenis } from '@studio-freight/react-lenis';
import ParticleBackground from './components/ParticleBackground';
import { Contact } from './components/sections/Contact/Contact';

import './index.css';
import styles from './App.module.css';
import './components/Arrow.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const lenis = useLenis();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const scrollToAbout = () => {
    if (!lenis) return;
    const aboutSection = document.getElementById('about');
    if (!aboutSection) return;

    lenis.scrollTo(aboutSection, {
      offset: -100,
      duration: 1.5,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
    });
  };

  return (
    <ThemeProvider>
      <div className={styles.container}>
        <Navigation scrollToSection={scrollToAbout} />
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
          <ScrollControls pages={5.2} damping={0.3} distance={0.5}>
            <BackgroundScene />
            <ParticleBackground />
            <Scroll html style={{ width: '100%' }}>
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <Loader key="loader" />
                ) : (
                  <main className={styles.main}>
                    <Home />
                    <div id="homeToAboutArrow" onClick={scrollToAbout}>
                      <div className="curveWrapper">
                        <div className="curve"></div>
                      </div>
                      <div className="point"></div>
                    </div>
                    <About />
                    <Skills />
                    <Projects />
                    <div className={styles.spacer} />
                    <Contact />
                  </main>
                )}
              </AnimatePresence>
            </Scroll>
          </ScrollControls>
          <Preload all />
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
    </ThemeProvider>
  );
}

export default App;