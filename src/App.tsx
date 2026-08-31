import { useEffect, useState, useCallback, useRef } from 'react';
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
import { useTheme } from './components/sections/theme/useTheme';
import { useGpuTier } from './lib/gateways/gpuTier';
import { setScrollProgress } from './lib/scroll/scrollProgress';
import { preserveScrollOffset, readScrollOffset } from './lib/scroll/preserveScrollOffset';
import { computeHoldRange, NO_HOLD } from './lib/camera/holdRange';
import { setCameraHold } from './lib/camera/cameraHold';
import { RenderGovernor } from './components/3d/RenderGovernor';

import './index.css';
import styles from './App.module.css';

/**
 * Page-count churn below this is ignored. Every applied change makes
 * ScrollControls rebuild its track, so the threshold is set well above routine
 * layout jitter -- roughly 135px on a 900px viewport -- while staying small
 * enough that no section becomes unreachable.
 */
const SCROLL_PAGE_EPSILON = 0.15;

/** The section that covers the world outright, and freezes it while it does. */
const OPAQUE_SECTION_ID = 'about';

/**
 * Content settles in bursts as images and fonts land. Collapsing a burst into
 * one track rebuild keeps the reader still instead of restoring repeatedly.
 */
const CONTENT_SETTLE_MS = 120;


function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [scrollPages, setScrollPages] = useState(1);
  /** Mirrors scrollPages, so the observer can compare without a stale closure. */
  const scrollPagesRef = useRef(1);
  const mainRef = useRef<HTMLElement | null>(null);
  const contentObserverRef = useRef<ResizeObserver | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  /** Reader position captured just before the track is resized. */
  const pendingRestoreRef = useRef<{ offset: number; fromPages: number } | null>(null);
  /** Frames left to re-announce a restored position to ScrollControls. */
  const restoreSyncFramesRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The context is optional by type -- it has no sensible default -- and this
  // hook is the project's existing way of asserting the provider is there.
  const { theme, toggleTheme } = useTheme();
  const gpuConfig = useGpuTier();

  /*
   * Publishes the tier to CSS.
   *
   * The heaviest thing in the stylesheet is not a colour or a transform, it is
   * backdrop-filter: every blurred panel makes the compositor read back and
   * blur everything behind it -- here, a live WebGL canvas -- on every frame
   * it moves. There is no media query for "this GPU cannot afford that", so
   * the tier has to travel from the detector to the stylesheet as an
   * attribute.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.quality = gpuConfig.tier;
    document.documentElement.dataset.backdropBlur = String(gpuConfig.enableBackdropBlur);
  }, [gpuConfig.tier, gpuConfig.enableBackdropBlur]);


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
    scrollElementRef.current = element;
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
    const node = mainRef.current;
    if (!node) return;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || 1 : 1;
    const contentHeight = node.scrollHeight || viewportHeight;

    // ScrollControls translates the html layer by -(pages - 1) * viewportHeight
    // across the full scroll, so pages === contentHeight / viewportHeight maps
    // the content 1:1 onto the scroll track. Every section stays reachable and
    // the track ends exactly where the content does, with no dead scroll.
    const calculatedPages = Math.max(contentHeight / viewportHeight, 1);

    // The opaque section covers the world completely, so the world holds still
    // for exactly as long as it does. Measured from layout rather than assumed,
    // because the same section owns a very different share of the scroll on a
    // tablet and on a 4K display.
    const opaque = document.getElementById(OPAQUE_SECTION_ID);
    setCameraHold(
      opaque
        ? computeHoldRange(
            opaque.offsetTop - (node.offsetTop || 0),
            opaque.offsetHeight,
            contentHeight,
            viewportHeight
          )
        : NO_HOLD
    );

    const previousPages = scrollPagesRef.current;

    if (Math.abs(previousPages - calculatedPages) <= SCROLL_PAGE_EPSILON) return;

    // ScrollControls rebuilds its track whenever `pages` changes, and that
    // rebuild resets scrollTop to 1. Capture where the reader is *now*, while
    // the old geometry is still in place, so the rebuild can be undone instead
    // of throwing them back to the top. Captured here rather than inside the
    // state updater, which React may defer or re-run.
    const track = scrollElementRef.current;
    if (track) {
      pendingRestoreRef.current = {
        offset: readScrollOffset(track),
        fromPages: previousPages,
      };
    }

    scrollPagesRef.current = calculatedPages;
    setScrollPages(calculatedPages);
  }, []);

  // Measuring from an effect is unreliable here: `Scroll html` portals its host
  // node from an effect of its own, so <main> is often still detached when a
  // layout effect runs. A one-shot measurement then freezes the track at
  // whatever the half-built DOM reported, and nothing ever re-measures.
  // Binding through a ref callback attaches the observer exactly when the node
  // appears, however late that is.
  /**
   * Puts the reader back where they were after ScrollControls rebuilds its
   * track. Driven from the render loop rather than an effect: Canvas mounts a
   * separate React root, so there is no parent/child effect ordering between
   * this component and ScrollControls, and an effect here can run *before* the
   * rebuild that resets scrollTop.
   */
  const applyPendingRestore = useCallback(() => {
    const track = scrollElementRef.current;
    if (!track) return;

    if (restoreSyncFramesRef.current > 0) {
      restoreSyncFramesRef.current -= 1;
      // ScrollControls ignores scroll events for one frame after a rebuild, so
      // re-announce the position once that guard has lifted.
      track.dispatchEvent(new Event('scroll'));
      return;
    }

    const pending = pendingRestoreRef.current;
    if (!pending) return;

    const scrollable = track.scrollHeight - track.clientHeight;
    if (scrollable <= 0) return;

    const nextPages = track.scrollHeight / track.clientHeight - 1;
    // Wait for the rebuild: until the track carries its new height, restoring
    // would measure against the geometry we are trying to leave behind.
    if (Math.abs(nextPages - pending.fromPages) < 1e-3) return;

    pendingRestoreRef.current = null;
    track.scrollTop =
      preserveScrollOffset(pending.offset, pending.fromPages, nextPages) * scrollable;
    restoreSyncFramesRef.current = 2;
  }, []);

  const attachMain = useCallback((node: HTMLElement | null) => {
    contentObserverRef.current?.disconnect();
    contentObserverRef.current = null;
    mainRef.current = node;

    if (!node) return;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(updateScrollPages, CONTENT_SETTLE_MS);
      });
      observer.observe(node);
      contentObserverRef.current = observer;
    }

    updateScrollPages();
  }, [updateScrollPages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', updateScrollPages);
    return () => window.removeEventListener('resize', updateScrollPages);
  }, [updateScrollPages]);

  useEffect(() => () => {
    contentObserverRef.current?.disconnect();
    contentObserverRef.current = null;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

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
                <ScrollManager onReady={handleScrollElement} onFrame={applyPendingRestore} />
                <BackgroundScene
                  theme={theme}
                  particleCount={gpuConfig.particleCount}
                  reflectionSize={gpuConfig.waterReflectionSize}
                  videoClips={gpuConfig.videoClips}
                />
                <ParticleBackground theme={theme} count={gpuConfig.particleCount} />
                <Scroll html style={{ width: '100%' }}>
                  {!isLoading && (
                    <main ref={attachMain} className={styles.main}>
                      <Home onNavigate={scrollToSection} />
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
              {/*
                Owns the render call, so frames behind an opaque section -- and
                frames above the tier's redraw ceiling -- are never drawn.
                Mounted last so it sits above every other frame subscriber.
              */}
              <RenderGovernor maxFps={gpuConfig.maxFps} />
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

function ScrollManager({
  onReady,
  onFrame,
}: {
  onReady: (el: HTMLDivElement | null) => void;
  onFrame: () => void;
}) {
  const scroll = useScroll();

  useEffect(() => {
    onReady(scroll?.el ?? null);
    return () => onReady(null);
  }, [scroll?.el, onReady]);

  // The page scrolls inside the ScrollControls element, so this is the only
  // place that knows the real progress. Publish it for the DOM layer.
  useFrame(() => {
    setScrollProgress(scroll?.offset ?? 0);
    onFrame();
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
