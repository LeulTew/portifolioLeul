import { useMemo, useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MODEL_PATH = '/models/me_animated_opt.glb';

interface MeModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  isDarkMode?: boolean;
}

export function MeModel({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: MeModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Load the GLB model with animations
  const { scene, animations } = useGLTF(MODEL_PATH);
  
  // Setup animations
  const { actions, names } = useAnimations(animations, groupRef);

  // Play animations on mount
  useEffect(() => {
    console.log('GLB Animation names:', names);
    if (names.length > 0 && actions) {
      // Play all animations
      names.forEach((name) => {
        const action = actions[name];
        if (action) {
          action.reset().fadeIn(0.5).play();
        }
      });
    }
  }, [actions, names]);

  // Configure shadows for the model
  useMemo(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  // Fallback: subtle floating if no animations
  useFrame((state) => {
    if (groupRef.current && names.length === 0) {
      const time = state.clock.getElapsedTime();
      groupRef.current.position.y = position[1] + Math.sin(time * 0.8) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

// Preload the model
useGLTF.preload(MODEL_PATH);
