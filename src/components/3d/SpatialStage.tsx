import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Preload, ScrollControls, Scroll, useScroll, type ScrollControlsState } from '@react-three/drei';
import { BackgroundScene } from '../BackgroundScene';
import ParticleBackground from '../ParticleBackground';
import { WorldCanvas } from './WorldCanvas';
import { ContextLossGuard } from './ContextLossGuard';
import { ThemeContext, type Theme } from '../sections/theme/ThemeContext';
import type { GpuTierConfig } from '@/lib/gateways/gpuTier';
import { reconcileScrollLayer } from '@/lib/scroll/reconcileScrollLayer';
import { setScrollProgress } from '@/lib/scroll/scrollProgress';

export interface SpatialStageProps {
  tier: GpuTierConfig;
  theme: Theme;
  toggleTheme: () => void;
  pages: number;
  onScrollElement: (element: HTMLDivElement | null, state: ScrollControlsState | null) => void;
  /** Runs first every frame; a number is a restored offset to hand Drei. */
  onFrame: () => number | null;
  onUnrecoverable: () => void;
  /** The story, rendered as Drei's scrolling HTML over the world. */
  children: ReactNode;
}

/**
 * The spatial page: the world canvas, Drei's scroll track and the story as
 * its HTML layer.
 *
 * Its own module, loaded only when the page can draw it, so a browser without
 * WebGL never downloads the renderer or the scene (round 10, TECH-029).
 */
export default function SpatialStage({
  tier, theme, toggleTheme, pages, onScrollElement, onFrame, onUnrecoverable, children,
}: SpatialStageProps) {
  return (
    <WorldCanvas
      tier={tier}
      onCreated={({ gl }) => { gl.domElement.setAttribute('aria-hidden', 'true'); }}
      camera={{ position: [0, 0, 10], fov: 50, near: 0.1, far: 100 }}
      gl={{
        antialias: tier.tier !== 'low',
        alpha: true,
        powerPreference: 'default',
        stencil: false,
        depth: true,
      }}
    >
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <ScrollControls pages={pages} damping={0.3}>
          <ScrollManager onReady={onScrollElement} onFrame={onFrame} />
          <BackgroundScene
            theme={theme}
            particleCount={tier.particleCount}
            reflectionSize={tier.waterReflectionSize}
            reflectionFps={tier.waterReflectionFps}
            videoClips={tier.videoClips}
            oceanSegments={tier.oceanSegments}
            oceanRings={tier.oceanRings}
          />
          <ParticleBackground theme={theme} count={tier.particleCount} />
          <Scroll html style={{ width: '100%' }}>
            {children}
          </Scroll>
        </ScrollControls>
        <Preload all />
        {/*
          A lost context throws nothing, so the error boundary around this
          stage cannot see it. Without this the backdrop simply stops drawing
          and the reader is left with a site whose world is missing.
        */}
        <ContextLossGuard onUnrecoverable={onUnrecoverable} />
      </ThemeContext.Provider>
    </WorldCanvas>
  );
}

function ScrollManager({
  onReady,
  onFrame,
}: {
  onReady: (el: HTMLDivElement | null, state: ScrollControlsState | null) => void;
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
