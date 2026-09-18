import { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { isFrameDrawn } from '@/lib/render/frameGate';
import { resolveSceneModel } from '@/lib/assets/criticalAssets';
import { CAMERA_CHAPTERS } from '@/lib/camera/cinematicSpline';
import { publishAvatarEchoFrame } from '@/lib/avatar/avatarEchoScene';

const MODEL_PATH = '/models/me-animated-lite.glb';

/** See BackgroundScene: meshopt everywhere, so no gstatic decoder fetch. */
const NO_DRACO = false;
const homePosition = new THREE.Vector3(...CAMERA_CHAPTERS[0].position);
const homeCamera = new THREE.PerspectiveCamera(50);
homeCamera.position.copy(homePosition);
homeCamera.lookAt(...CAMERA_CHAPTERS[0].target);

interface MeModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  isDarkMode?: boolean;
}

export function MeModel({ position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }: MeModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Load the GLB model with animations
  const { scene, animations } = useGLTF(resolveSceneModel(MODEL_PATH), NO_DRACO);
  
  // Setup animations
  const { actions, names } = useAnimations(animations, groupRef);

  useEffect(() => () => publishAvatarEchoFrame(false, 0), []);

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

  // These resources belong to the shared GLTF cache, not to this instance.
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

  }, [scene]);

  // Fallback: subtle floating if no animations
  useFrame((state) => {
    if (!isFrameDrawn(state.clock.elapsedTime)) return;

    if (groupRef.current && names.length === 0) {
      const time = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(time * 0.8) * 0.15;
    }
    const action = actions[names[0]];
    const camera = state.camera;
    publishAvatarEchoFrame(
      Boolean(action && camera instanceof THREE.PerspectiveCamera &&
        camera.position.distanceToSquared(homePosition) < 0.000001 &&
        1 - Math.abs(camera.quaternion.dot(homeCamera.quaternion)) < 0.000001 &&
        camera.fov === homeCamera.fov),
      action?.time ?? 0,
    );
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} dispose={null} />
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
