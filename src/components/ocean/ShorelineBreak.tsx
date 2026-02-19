import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OceanTheme } from './oceanConfig';

interface ShorelineBreakProps {
  theme: OceanTheme;
  position?: [number, number, number];
}

const SHORE_SEGMENTS = 160;

export function ShorelineBreak({ theme, position = [0, -3.92, -20] }: ShorelineBreakProps) {
  const ringRefs = useRef<Array<THREE.Mesh | null>>([]);

  const crests = useMemo(
    () => [
      { inner: 57.6, outer: 58.5, speed: 0.19, amplitude: 0.024, baseOpacity: 0.21, phase: 0 },
      { inner: 60.2, outer: 61.0, speed: 0.16, amplitude: 0.02, baseOpacity: 0.15, phase: 1.4 },
    ],
    []
  );

  const crestColor = theme === 'light' ? '#f3fcff' : '#e7fbff';

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    ringRefs.current.forEach((ring, index) => {
      if (!ring) return;

      const cfg = crests[index];
      const cycle = (Math.sin(time * cfg.speed + cfg.phase) + 1) * 0.5;
      const scale = 1 + cycle * cfg.amplitude;
      const material = ring.material;
      if (!(material instanceof THREE.MeshBasicMaterial)) return;

      ring.scale.set(scale, scale, 1);
      ring.rotation.z = (index % 2 === 0 ? 1 : -1) * time * 0.008;
      material.opacity = cfg.baseOpacity + cycle * 0.08;
    });
  });

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      {crests.map((crest, index) => (
        <mesh
          key={index}
          ref={(node) => {
            ringRefs.current[index] = node;
          }}
          renderOrder={2}
        >
          <ringGeometry args={[crest.inner, crest.outer, SHORE_SEGMENTS]} />
          <meshBasicMaterial
            color={crestColor}
            transparent
            opacity={crest.baseOpacity}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
