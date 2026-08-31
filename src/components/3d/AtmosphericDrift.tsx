import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEFAULT_DRIFT_BOUNDS, createDriftSeeds, type DriftBounds } from '@/lib/atmosphere/drift';
import { writeDriftInstances } from '@/lib/atmosphere/writeDriftInstances';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { isFrameDrawn } from '@/lib/render/frameGate';

/**
 * Slow motes drifting through the island's air, on a single instanced draw
 * call. Purely atmospheric: it adds no geometry to the scene's authored
 * composition and casts nothing.
 *
 * The geometry and material are declared as children, so the reconciler owns
 * their lifetime and disposes them on unmount. Only imperatively constructed
 * resources -- the cloned terrain in BackgroundScene, for instance -- need a
 * disposal pass of their own.
 */

/** Motes are small enough to read as airborne dust rather than as objects. */
const MOTE_SIZE = 0.045;

export interface AtmosphericDriftProps {
  /** Instance count, normally taken from the GPU tier budget. */
  count: number;
  color: string;
  bounds?: DriftBounds;
  opacity?: number;
}

export function AtmosphericDrift({
  count,
  color,
  bounds = DEFAULT_DRIFT_BOUNDS,
  opacity = 0.55,
}: AtmosphericDriftProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => createDriftSeeds(count, bounds), [count, bounds]);

  // Lay the field out once, so a reduced-motion visitor still sees it and the
  // first animated frame does not pop in from the origin.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    writeDriftInstances(mesh, seeds, count, 0, bounds, null);
  }, [seeds, count, bounds]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || count <= 0) return;
    if (getPrefersReducedMotion()) return;
    // Writing a matrix per mote is the most expensive thing this page does per
    // frame on the CPU. Skip it on any frame that will not be drawn -- which
    // includes every frame behind the opaque section this used to test for
    // directly, and every frame above the tier's redraw ceiling.
    if (!isFrameDrawn(state.clock.getElapsedTime())) return;

    // The camera orbits through this field, so motes approaching the lens are
    // scaled away rather than rendering as large bright shapes.
    writeDriftInstances(
      mesh,
      seeds,
      count,
      state.clock.getElapsedTime(),
      bounds,
      state.camera?.position
    );
  });

  if (count <= 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[MOTE_SIZE, 0]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
