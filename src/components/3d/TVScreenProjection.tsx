import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { getProjectsSurface, getProjectsView, setTVScreenReady } from '@/lib/projects/projectsScene';
import { fitTVScreen, TVScreenProjector } from '@/lib/projects/tvScreen';
import { writeAttribute, writeStyleProperty } from '@/lib/dom/cachedElement';
import { isFrameDrawn } from '@/lib/render/frameGate';
import { easeInOutCubic } from '@/lib/motion/triggeredPhase';
import { Matrix4 } from 'three';

export function TVScreenProjection() {
  const projector = useMemo(() => new TVScreenProjector(), []);
  const previous = useMemo(() => ({
    world: new Matrix4(), projection: new Matrix4(),
    surface: null as HTMLElement | null, width: 0, height: 0, approach: -1, visit: -1,
  }), []);
  useEffect(() => {
    setTVScreenReady(true);
    return () => setTVScreenReady(false);
  }, []);

  // After the camera (0), before the existing render governor (1).
  useFrame(state => {
    const view = getProjectsView();
    const surface = getProjectsSurface();
    if (!view.active || !surface || !isFrameDrawn(state.clock.elapsedTime)) return;
    state.camera.updateMatrixWorld();
    const { width, height } = state.size;
    if (previous.surface === surface && previous.width === width && previous.height === height &&
        previous.visit === view.visit &&
        previous.approach === view.approach && previous.world.equals(state.camera.matrixWorld) &&
        previous.projection.equals(state.camera.projectionMatrix)) return;
    const resized = previous.surface !== surface || previous.width !== width || previous.height !== height;
    previous.surface = surface;
    previous.visit = view.visit;
    previous.width = width;
    previous.height = height;
    previous.approach = view.approach;
    previous.world.copy(state.camera.matrixWorld);
    previous.projection.copy(state.camera.projectionMatrix);
    const matrix = projector.matrix(state.camera, width, height);
    if (resized) {
      const fit = fitTVScreen(width, height);
      writeStyleProperty(surface, 'width', `${fit.width}px`);
      writeStyleProperty(surface, 'height', `${fit.height}px`);
      // The reader's chrome yields the corner band only when the cabinet takes it.
      writeAttribute(surface, 'data-frame', fit.tight ? 'tight' : 'full');
    }
    if (matrix) writeStyleProperty(surface, 'transform', matrix);
    writeStyleProperty(surface, 'opacity', matrix
      ? String(easeInOutCubic(Math.max(0, Math.min(1, (view.approach - 0.15) / 0.7)))) : '0');
  }, 0.5);
  return null;
}
