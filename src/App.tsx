import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { ErrorBoundary } from 'react-error-boundary';
import { Loader } from './components/Loader';
import { Navigation } from './components/Navigation';
import { Home } from './components/sections/Home/Home';
import { About } from './components/sections/About/About';
import { aboutNavigationInset } from './components/sections/About/aboutNavigation';
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
import { createTrackFocusRecovery } from './lib/scroll/preserveTrackFocus';
import { computeHoldRange, NO_HOLD } from './lib/camera/holdRange';
import { setCameraFreezes, setWorldOcclusion } from './lib/camera/cameraHold';
import { RenderGovernor } from './components/3d/RenderGovernor';
import { ContextLossGuard } from './components/3d/ContextLossGuard';
import { releaseCriticalAssets } from './lib/assets/criticalAssets';
import { isWebGLAvailable } from './lib/render/webglSupport';
import { isSceneReady, subscribeSceneReady } from './lib/render/sceneReady';
import { watchContentSettled, type ContentSettleWatcher } from './lib/render/contentSettled';
import { useChapterInk } from './lib/scroll/chapterInk';
import { useActiveSection } from './lib/scroll/useActiveSection';
import { ChapterInkLayer, InkLabel } from './components/ui/ChapterInkLayer/ChapterInkLayer';
import { glideScrollTo, type Glide } from './lib/scroll/glideScroll';
import { publishSectionNavigation, type SectionNavigationOptions } from './lib/scroll/sectionNavigation';
import { settleScrollPosition } from './lib/scroll/settleScrollPosition';
import { reconcileScrollLayer } from './lib/scroll/reconcileScrollLayer';
import { installLayerFocus } from './lib/scroll/layerFocus';
import { useResizeAnchor } from './lib/scroll/resizeAnchor';
import { AvatarEncounter } from './components/avatar/AvatarEncounter';
import { TVControls } from './components/tv/TVControls';
import { setAvatarLayoutReady } from './lib/avatar/avatarEncounter';

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
 * The section that holds the reader still with the world still in view.
 *
 * It freezes the camera without hiding anything, which is the distinction the
 * two lists below exist for.
 */
const HELD_SECTION_ID = 'home';

/**
 * Content settles in bursts as images and fonts land. Collapsing a burst into
 * one track rebuild keeps the reader still instead of restoring repeatedly.
 */
const CONTENT_SETTLE_MS = 120;

/**
 * How long the loader may run before the page opens regardless.
 *
 * Long enough that no genuine load reaches it -- the critical assets are under
 * five megabytes, so this is roughly a 20kbit connection -- and short enough
 * that a network black hole is not a dead end.
 */
const LOADER_FAILSAFE_MS = 45_000;


function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [scrollPages, setScrollPages] = useState(1);
  /** Mirrors scrollPages, so the observer can compare without a stale closure. */
  const scrollPagesRef = useRef(1);
  const mainRef = useRef<HTMLElement | null>(null);
  const contentObserverRef = useRef<ResizeObserver | null>(null);
  const settleWatcherRef = useRef<ContentSettleWatcher | null>(null);
  /** The in-flight navigation glide, so a second click replaces the first. */
  const glideRef = useRef<Glide | null>(null);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const scrollStateRef = useRef<ReturnType<typeof useScroll> | null>(null);
  /** Reader position captured just before the track is resized. */
  const pendingRestoreRef = useRef<{ offset: number; fromPages: number } | null>(null);
  const trackFocus = useMemo(createTrackFocusRecovery, []);

  const handleLoaded = useCallback(() => setIsLoading(false), []);
  /** Frames left to re-announce a restored position to ScrollControls. */
  const restoreSyncFramesRef = useRef(0);
  const restoredOffsetRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The context is optional by type -- it has no sensible default -- and this
  // hook is the project's existing way of asserting the provider is there.
  const { theme, toggleTheme } = useTheme();
  const gpuConfig = useGpuTier();
  useChapterInk();

  /*
   * Asked once, before anything tries to mount a canvas.
   *
   * Every section of this page is rendered inside drei's `Scroll html`, which
   * lives inside the Canvas -- so a browser that will not give us a context
   * did not lose the island, it lost the whole site. That is what the error
   * boundary around the Canvas was catching: a blank page reading "something
   * went wrong" for a reader whose browser is working exactly as configured.
   *
   * Firefox says "WebGL is currently disabled" for a handful of ordinary
   * reasons -- acceleration off, `webgl.disabled` set, a hardened profile, a
   * blocklisted driver -- none of which are faults to recover from. The page
   * asks, and does without.
   */
  const canRender3D = useMemo(() => isWebGLAvailable(), []);
  const [webglRuntimeError, setWebglRuntimeError] = useState(false);
  const show3D = canRender3D && !webglRuntimeError;
  // The flat page scrolls the document itself; the 3D track preserves its own offset.
  useResizeAnchor(!show3D);
  useEffect(() => {
    if (!show3D) trackFocus.cancel();
  }, [show3D, trackFocus]);

  /*
   * The context went away and did not come back. Take the 3D layer down and
   * render the sections flat -- the same page a browser without WebGL gets,
   * rather than a backdrop that is permanently blank.
   */
  const handleContextUnrecoverable = useCallback(() => {
    console.warn('WebGL context was not restored; falling back to the flat page.');
    setWebglRuntimeError(true);
  }, []);

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


  const handleScrollElement = useCallback((
    element: HTMLDivElement | null,
    state: ReturnType<typeof useScroll> | null
  ) => {
    scrollElementRef.current = element;
    scrollStateRef.current = state;
    setScrollElement(element);
  }, []);

  /*
   * A last resort, and nothing more.
   *
   * This was eight seconds, which is not a failsafe -- it is a deadline. On a
   * slow connection it fired while the island was still downloading, tore the
   * loader away mid-fill and handed the visitor a finished-looking page with
   * an empty world filling in behind it. That is the thing being reported.
   *
   * The loader now owns readiness: it opens the page when the assets are in.
   * This only exists so that a network that never answers at all cannot leave
   * someone staring at the letters forever, and it is set far beyond any real
   * load.
   */
  useEffect(() => {
    const stalled = setTimeout(handleLoaded, LOADER_FAILSAFE_MS);
    return () => clearTimeout(stalled);
  }, [handleLoaded]);

  /*
   * The prefetched model bytes have done their job -- but only once the scene
   * says so.
   *
   * They are held in three's cache so GLTFLoader takes them from memory rather
   * than asking the network again, and dropping them is worth several
   * megabytes. Dropping them too early is worth a second download of every
   * model, which is exactly what the prefetch exists to avoid.
   *
   * This used to key off the loader closing, which is not the same event: the
   * loader will open the page after a grace period even if the scene has not
   * finished parsing, and any model that had not been asked for yet then went
   * back to the network. Measured on the deployed site as two fetches of every
   * model. The scene's own ready signal is the one that means every useGLTF
   * has resolved; if it never comes, the buffers are simply kept.
   */
  useEffect(() => {
    if (isSceneReady()) {
      releaseCriticalAssets();
      return;
    }
    return subscribeSceneReady(() => {
      if (isSceneReady()) releaseCriticalAssets();
    });
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

    /*
     * Where the camera stands still, and where nothing is drawn at all.
     *
     * Both measured from layout rather than assumed, because the same section
     * owns a very different share of the scroll on a tablet and on a 4K
     * display. Both live here because this is the only place that knows the
     * content's height, which is what turns a section's pixels into a share of
     * the page's scroll.
     *
     * They are not the same list. The opaque section covers the world outright,
     * so it both freezes the viewpoint and makes drawing pointless. The hero
     * holds the reader still with the world in full view: the camera has to
     * stop -- otherwise the scroll spent on the handover flies the viewpoint
     * across the island, which is exactly what it did -- but the world must go
     * on being drawn.
     */
    const rangeOf = (id: string) => {
      const section = document.getElementById(id);
      if (!section) return NO_HOLD;
      return computeHoldRange(
        section.offsetTop - (node.offsetTop || 0),
        section.offsetHeight,
        contentHeight,
        viewportHeight
      );
    };

    const occluded = rangeOf(OPAQUE_SECTION_ID);
    setWorldOcclusion(occluded);

    /*
     * The hero's freeze runs right up to where About's begins, so the two are
     * contiguous and the camera does not move once between them.
     *
     * The hero's own box ends a screen before About starts, and that gap is
     * precisely where the handover happens: the plate shuts, the cue is drawn,
     * and About's panel climbs to the top. Freezing only the hero's box left
     * the camera free for exactly that stretch -- so the one part of the page
     * whose whole point is that the world waits was the part where it moved.
     */
    const held = rangeOf(HELD_SECTION_ID);
    const heroFreeze =
      held !== NO_HOLD && occluded !== NO_HOLD && occluded.start > held.start
        ? { start: held.start, end: occluded.start }
        : held;

    setCameraFreezes([heroFreeze, occluded]);

    const previousPages = scrollPagesRef.current;

    if (Math.abs(previousPages - calculatedPages) <= SCROLL_PAGE_EPSILON) {
      setAvatarLayoutReady(!pendingRestoreRef.current && restoreSyncFramesRef.current === 0 &&
        !settleTimerRef.current);
      return;
    }

    // ScrollControls rebuilds its track whenever `pages` changes, and that
    // rebuild resets scrollTop to 1. Capture where the reader is *now*, while
    // the old geometry is still in place, so the rebuild can be undone instead
    // of throwing them back to the top. Captured here rather than inside the
    // state updater, which React may defer or re-run.
    const track = scrollElementRef.current;
    if (track) {
      trackFocus.capture(track);
      setAvatarLayoutReady(false);
      pendingRestoreRef.current = {
        offset: readScrollOffset(track),
        fromPages: previousPages,
      };
    }

    scrollPagesRef.current = calculatedPages;
    setScrollPages(calculatedPages);
  }, [trackFocus]);

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
  const applyPendingRestore = useCallback((): number | null => {
    const track = scrollElementRef.current;
    const pending = pendingRestoreRef.current;
    const expectedOffset = pending
      ? preserveScrollOffset(pending.offset, pending.fromPages, scrollPagesRef.current)
      : null;
    if (!track) return expectedOffset;

    if (restoreSyncFramesRef.current > 0) {
      restoreSyncFramesRef.current -= 1;
      // ScrollControls ignores scroll events for one frame after a rebuild, so
      // re-announce the position once that guard has lifted.
      track.dispatchEvent(new Event('scroll'));
      if (restoreSyncFramesRef.current === 0 && !settleTimerRef.current) {
        trackFocus.restore();
        setAvatarLayoutReady(true);
      }
      return restoredOffsetRef.current;
    }

    if (!pending) {
      if (!settleTimerRef.current) {
        trackFocus.restore();
        setAvatarLayoutReady(true);
      }
      return null;
    }

    const scrollable = track.scrollHeight - track.clientHeight;
    if (scrollable <= 0) return expectedOffset;

    const nextPages = track.scrollHeight / track.clientHeight - 1;
    // Wait for the rebuild: until the track carries its new height, restoring
    // would measure against the geometry we are trying to leave behind.
    if (Math.abs(nextPages - pending.fromPages) < 1e-3) return expectedOffset;

    pendingRestoreRef.current = null;
    const offset = preserveScrollOffset(pending.offset, pending.fromPages, nextPages);
    track.scrollTop = offset * scrollable;
    restoredOffsetRef.current = offset;
    restoreSyncFramesRef.current = 2;
    return offset;
  }, [trackFocus]);

  const attachMain = useCallback((node: HTMLElement | null) => {
    contentObserverRef.current?.disconnect();
    contentObserverRef.current = null;
    settleWatcherRef.current?.stop();
    settleWatcherRef.current = null;
    mainRef.current = node;

    if (!node) return;

    // The loader is told when this has stopped moving, so it can stay up over
    // the settling rather than fading away across it. Driven off the same
    // observer as the track, because both are answers to "has the content
    // finished moving" and a second observer on this node would be the same
    // work twice.
    const watcher = watchContentSettled();
    settleWatcherRef.current = watcher;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        watcher.poke();
        setAvatarLayoutReady(false);
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
          updateScrollPages();
        }, CONTENT_SETTLE_MS);
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
    settleWatcherRef.current?.stop();
    settleWatcherRef.current = null;
    glideRef.current?.cancel();
    glideRef.current = null;
    trackFocus.cancel();
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, [trackFocus]);

  const scrollToSection = useCallback((id: string, options?: SectionNavigationOptions) => {
    const target = document.getElementById(id);
    if (!target) return;
    trackFocus.cancel();
    const immediate = options?.immediate || options?.source === 'navbar';
    if (options?.source === 'navbar') {
      pendingRestoreRef.current = null;
      restoreSyncFramesRef.current = 0;
    }
    publishSectionNavigation(id, options);

    if (scrollElement && mainRef.current) {
      const container = scrollElement;
      const main = mainRef.current;
      const containerScrollable = Math.max(container.scrollHeight - container.clientHeight, 1);
      const contentScrollable = Math.max(main.scrollHeight - container.clientHeight, 1);
      const rawOffset = id === 'home' ? 0 : target.offsetTop - (main.offsetTop || 0);

      let adjustedOffset = 0;
      if (id === 'home') {
        adjustedOffset = 0;
      } else if (id === 'about') {
        // Only navbar intent lands inside the first readable beat. Natural
        // handoffs retain the authored heading entry and completion gates.
        const clientHeight = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
        adjustedOffset = rawOffset + aboutNavigationInset(clientHeight, options?.source);
      } else if (options?.edge === 'end') {
        adjustedOffset = Math.max(rawOffset + target.offsetHeight - container.clientHeight + 80, 0);
      } else {
        adjustedOffset = Math.max(rawOffset - 80, 0);
      }

      const ratio = Math.min(1, Math.max(0, adjustedOffset / contentScrollable));

      /*
       * Eased here rather than by the browser.
       *
       * This was `scrollTo({ behavior: 'smooth' })`, which is silently inert on
       * this container: it belongs to drei's ScrollControls, which writes
       * `scrollTop` itself every frame to drive its damping, and a script
       * assignment cancels an in-flight native smooth scroll. The animation was
       * being killed on the frame after it began, so every navigation link did
       * nothing at all -- measured in a real browser, `scrollTop` never left 0
       * while a plain instant assignment worked. See `glideScrollTo`.
       */
      glideRef.current?.cancel();
      if (immediate) {
        glideRef.current = null;
        if (scrollStateRef.current) settleScrollPosition(scrollStateRef.current, ratio);
        else {
          container.scrollTop = ratio * containerScrollable;
          container.dispatchEvent(new Event('scroll'));
        }
        return;
      }
      glideRef.current = glideScrollTo(container, ratio * containerScrollable);
      return;
    }

    if (immediate) {
      const inset = options?.edge === 'end'
        ? target.offsetHeight - window.innerHeight + 80
        : id === 'about' ? aboutNavigationInset(window.innerHeight, options?.source) : -80;
      const top = id === 'home' ? 0 : target.getBoundingClientRect().top + window.scrollY + inset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      // An unchanged native position emits no scroll event on a repeated visit.
      window.dispatchEvent(new Event('scroll'));
      return;
    }

    const glide: ScrollBehavior = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (id === 'about') {
      const aboutEl = document.getElementById('about');
      if (aboutEl && typeof window !== 'undefined') {
        const top = aboutEl.offsetTop + aboutNavigationInset(window.innerHeight);
        window.scrollTo({ top, behavior: glide });
        return;
      }
    }

    target.scrollIntoView({ behavior: glide, block: 'start' });
  }, [scrollElement, trackFocus]);

  // Keyboard focus is navigation intent: the page follows it as it follows the navbar.
  useEffect(() => {
    if (!show3D || !scrollElement) return;
    return installLayerFocus({
      track: scrollElement,
      main: () => mainRef.current,
      navigate: section => scrollToSection(section, { source: 'navbar' }),
      renderedScrollTop: () => {
        const state = scrollStateRef.current;
        const range = Math.max(scrollElement.scrollHeight - scrollElement.clientHeight, 0);
        return state ? state.offset * range : scrollElement.scrollTop;
      },
    });
  }, [show3D, scrollElement, scrollToSection]);

  /*
   * One definition, rendered either inside the canvas's scroll layer or
   * straight into the document. Written once so the two paths cannot drift
   * into being two different sites.
   *
   * Mounted from the first render, and deliberately not held back until the
   * loader is on its way out. Everything that happens when these appear --
   * images decoding, the webfont swapping, `<main>` being measured,
   * `ScrollControls` rebuilding its track and resetting scrollTop -- used to
   * happen *during* the loader's fade, in full view. Mounting under an opaque
   * overlay means the visitor sees a settled page when it lifts, and
   * `watchContentSettled` is what keeps it down until that is true.
   */
  const sections = (
    <main ref={attachMain} className={styles.main}>
      <Home onNavigate={scrollToSection} theme={theme} flat={!show3D} introReady={!isLoading} />
      <About onNavigate={scrollToSection} />
      <Skills onNavigate={scrollToSection} />
      <Projects theme={theme} spatial={show3D} onNavigate={scrollToSection} />
      <div className={styles.spacer} />
      <Contact spatial={show3D} />
      <footer className={styles.compactFooter} data-testid="compact-page-footer">
        <div className={styles.year}><InkLabel text={`© ${new Date().getFullYear()}`} painted={false} /></div>
      </footer>
    </main>
  );

  return (
    <div className={styles.container}>
      <AnimatePresence>
        {isLoading && <Loader key="loader" theme={theme} onLoaded={handleLoaded} scene={show3D} />}
      </AnimatePresence>

      {!isLoading && (
        <Navigation scrollToSection={scrollToSection} />
      )}

      {!show3D && sections}

      {show3D && (
      <ErrorBoundary
        fallbackRender={() => null}
        onError={(error) => {
          console.warn('3D Canvas encountered an error, falling back to 2D view:', error);
          setWebglRuntimeError(true);
        }}
      >
          <Canvas
            dpr={gpuConfig.dpr}
            onCreated={({ gl }) => { gl.domElement.setAttribute('aria-hidden', 'true'); }}
            camera={{
              position: [0, 0, 10],
              fov: 50,
              near: 0.1,
              far: 100
            }}
            gl={{
              antialias: gpuConfig.tier !== 'low',
              alpha: true,
              powerPreference: 'default',
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
                  reflectionFps={gpuConfig.waterReflectionFps}
                  videoClips={gpuConfig.videoClips}
                  oceanSegments={gpuConfig.oceanSegments}
                  oceanRings={gpuConfig.oceanRings}
                />
                <ParticleBackground theme={theme} count={gpuConfig.particleCount} />
                <Scroll html style={{ width: '100%' }}>
                  {sections}
                </Scroll>
              </ScrollControls>
              <Preload all />
              {/*
                Owns the render call, so frames behind an opaque section -- and
                frames above the tier's redraw ceiling -- are never drawn.
                Mounted last so it sits above every other frame subscriber.
              */}
              <RenderGovernor maxFps={gpuConfig.maxFps} />
              {/*
                A lost context throws nothing, so the error boundary above
                cannot see it. Without this the backdrop simply stops drawing
                and the reader is left with a site whose world is missing.
              */}
              <ContextLossGuard onUnrecoverable={handleContextUnrecoverable} />
            </ThemeContext.Provider>
          </Canvas>
        


      </ErrorBoundary>
      )}

      <AvatarEncounter enabled={!isLoading && show3D} scrollElement={scrollElement} />
      <TVControls enabled={!isLoading && show3D} scrollElement={scrollElement} />

      {!isLoading && <PageFooter />}
    </div>
  );
}

export default App;

function PageFooter() {
  const section = useActiveSection(['home', 'about', 'skills', 'projects', 'contact']);
  const paint = (painted: boolean) => (
    <motion.footer
      className={`${styles.footer} ${painted ? styles.paintedFooter : ''}`}
      data-testid={painted ? undefined : 'page-footer'}
      data-page-footer=""
      data-footer-section={section}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1], delay: 0.4 }}
    >
      {section !== 'contact' && <div className={styles.scroll}>
        <div className={styles.scrollText}><InkLabel text="Scroll to explore" painted={painted} /></div>
        <div className={styles.scrollLine} />
      </div>}
      <div className={styles.year}><InkLabel text={`© ${new Date().getFullYear()}`} painted={painted} /></div>
    </motion.footer>
  );
  return <>
    {paint(false)}
    <ChapterInkLayer className={styles.footerInk}>{paint(true)}</ChapterInkLayer>
  </>;
}

function ScrollManager({
  onReady,
  onFrame,
}: {
  onReady: (el: HTMLDivElement | null, state: ReturnType<typeof useScroll> | null) => void;
  onFrame: () => number | null;
}) {
  const scroll = useScroll();

  useEffect(() => {
    onReady(scroll?.el ?? null, scroll ?? null);
    return () => onReady(null, null);
  }, [scroll, onReady]);

  // The page scrolls inside the ScrollControls element, so this is the only
  // place that knows the real progress. Publish it for the DOM layer.
  useFrame((state) => {
    const restored = onFrame();
    if (scroll && restored !== null) {
      // Restoring only scrollTop lets Drei damp its new offset from zero,
      // briefly publishing a fictitious return through earlier chapters.
      scroll.offset = restored;
      scroll.delta = 0;
    }
    // Drei 9 skips HTML transforms at zero delta, including a reset to zero
    // after rebuilding pages. Reconcile only settled, physically agreed state;
    // moving frames remain exclusively Drei's, and pending restores stay put.
    const geometryChanged = scroll ? reconcileScrollLayer(scroll, state.size.height) : false;
    setScrollProgress(scroll?.offset ?? 0, geometryChanged);
  });

  return null;
}
