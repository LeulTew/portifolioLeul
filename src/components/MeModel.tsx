import { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isFrameDrawn } from '@/lib/render/frameGate';

const MODEL_PATH = '/models/me-animated-lite.glb';

/** See BackgroundScene: meshopt everywhere, so no gstatic decoder fetch. */
const NO_DRACO = false;

interface MeModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  isDarkMode?: boolean;
}

export function MeModel({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: MeModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Load the GLB model with animations
  const { scene, animations } = useGLTF(MODEL_PATH, NO_DRACO);
  
  // Setup animations
  const { actions, names } = useAnimations(animations, groupRef);

  // Play animations on mount
  useEffect(() => {
    if (names.length > 0 && actions) {
      names.forEach((name) => {
        const action = actions[name];
        if (action) {
          action.reset().fadeIn(0.5).play();
        }
      });
    }
  }, [actions, names]);

  // Configure shadows & material highlights for high visual clarity, with disposal on unmount
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if ('roughness' in child.material && typeof child.material.roughness === 'number') {
            child.material.roughness = 0.55;
          }
          if ('envMapIntensity' in child.material && typeof child.material.envMapIntensity === 'number') {
            child.material.envMapIntensity = 1.6;
          }
        }
      }
    });

    return () => {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };
  }, [scene]);

  // Fallback: subtle floating if no animations
  useFrame((state) => {
    if (!isFrameDrawn(state.clock.getElapsedTime())) return;

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
/*
 * Deliberately no useGLTF.preload here.
 *
 * It fires its own request the moment this module is imported, which raced the
 * critical-asset manifest and fetched the model twice -- measured in the
 * browser, and on a slow connection that is the whole download again. The
 * manifest owns preloading now, and it hands the bytes to three's cache, so
 * useGLTF resolves without going near the network. See lib/assets.
 */
