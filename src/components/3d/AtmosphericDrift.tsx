import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_DRIFT_BOUNDS, createDriftSeeds, type DriftBounds } from '@/lib/atmosphere/drift';
import { writeDriftInstances } from '@/lib/atmosphere/writeDriftInstances';
import { getCameraHold } from '@/lib/camera/cameraHold';
import { isWithinHold } from '@/lib/camera/holdRange';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

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
  const scroll = useScroll();
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
    // Nothing to see while an opaque section covers the world.
    if (isWithinHold(scroll?.offset ?? 0, getCameraHold())) return;

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
