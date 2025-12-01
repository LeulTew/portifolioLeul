import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface MeModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  isDarkMode?: boolean;
}

export function MeModel({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: MeModelProps) {
  // Load the GLB model
  const { scene } = useGLTF('/models/me-opt.glb');

  // Configure shadows for the model
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Preload the model
useGLTF.preload('/models/me-opt.glb');
