import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { isFrameDrawn, setFrameBudget } from '@/lib/render/frameGate';

/**
 * Takes ownership of the render call, so frames the gate has ruled out are
 * never drawn.
 *
 * A `useFrame` subscriber with a priority above zero suspends R3F's automatic
 * render, which is the documented way to drive the loop yourself. Every other
 * subscriber on this page sits at the default priority of zero, so they all
 * run first and this one draws what they produced -- the ordering the default
 * loop would have used anyway.
 *
 * Mount it inside the Canvas exactly once.
 */

/** Above every other subscriber on the page, so this runs last. */
const RENDER_PRIORITY = 1;

export interface RenderGovernorProps {
  /**
   * Redraw ceiling in frames per second. Zero, or anything non-finite, draws
   * on every frame the browser offers.
   */
  maxFps?: number;
}

export function RenderGovernor({ maxFps = 0 }: RenderGovernorProps = {}) {
  useEffect(() => {
    setFrameBudget(maxFps > 0 ? 1 / maxFps : 0);
  }, [maxFps]);

  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useFrame((state) => {
    if (!isFrameDrawn(state.clock.getElapsedTime())) return;
    gl.render(scene, camera);
  }, RENDER_PRIORITY);

  return null;
}
