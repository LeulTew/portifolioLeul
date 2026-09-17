import { useLayoutEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { OceanTheme } from '@/components/ocean/oceanConfig';
import {
  bindHorizonBackground,
  createEdgeResources,
  enableHorizonLayer,
} from '@/lib/scene/edgeResources';

export function SceneEdgeContinuity({
  terrain,
  theme = 'light',
  softwareRenderer = false,
}: { terrain: THREE.Object3D; theme?: OceanTheme; softwareRenderer?: boolean }) {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const [resources, setResources] = useState<ReturnType<typeof createEdgeResources> | null>(null);

  useLayoutEffect(() => {
    const next = createEdgeResources(terrain, theme, softwareRenderer);
    try {
      bindHorizonBackground(next.horizon.material, scene);
      setResources(next);
    } catch (error) {
      next.dispose();
      throw error;
    }
    return () => next.dispose();
  }, [terrain, scene, theme, softwareRenderer]);

  useLayoutEffect(() => enableHorizonLayer(camera), [camera]);

  if (!resources) return null;

  return (
    <>
      <primitive object={resources.skirt} dispose={null} />
      <primitive object={resources.horizon} dispose={null} />
    </>
  );
}
