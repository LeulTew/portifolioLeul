import { useRef, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { drawnFrameDelta, isFrameDrawn, isWorldOccluded } from '@/lib/render/frameGate';
import { AvatarAnimation } from '@/lib/render/avatarAnimation';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { resolveSceneModel } from '@/lib/assets/criticalAssets';
import { getAvatarEncounter, setAvatarAvailability } from '@/lib/avatar/avatarEncounter';
import { AvatarAcknowledgement } from '@/lib/avatar/avatarRig';
import { AvatarProjection } from '@/lib/avatar/avatarProjection';

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
  const animationRef = useRef<AvatarAnimation | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  
  // Load the GLB model with animations
  const { scene, animations } = useGLTF(resolveSceneModel(MODEL_PATH), NO_DRACO);
  
  const acknowledgement = useMemo(() => new AvatarAcknowledgement(scene), [scene]);
  const projection = useMemo(() => new AvatarProjection(scene.getObjectByName('mixamorigSpine2')), [scene]);

  useEffect(() => {
    // Drei's useAnimations owns a separate, ungated RAF mixer subscription.
    // Owning this mixer keeps skipped/hidden frames from evaluating the rig.
    const animation = new AvatarAnimation(scene, animations, acknowledgement);
    animationRef.current = animation;
    return () => {
      animationRef.current = null;
      animation.dispose();
      setAvatarAvailability(false);
    };
  }, [scene, animations, acknowledgement]);

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
  useFrame((state, delta) => {
    if (!isFrameDrawn(state.clock.elapsedTime)) {
      if (document.hidden || isWorldOccluded()) {
        animationRef.current?.suspend();
        setAvatarAvailability(false);
      }
      return;
    }

    if (groupRef.current && animations.length === 0 && !reducedMotion) {
      const time = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(time * 0.8) * 0.15;
    }
    const encounter = getAvatarEncounter();
    animationRef.current?.update(
      drawnFrameDelta(state.clock.elapsedTime, delta), encounter.attention, encounter.nod, reducedMotion,
    );
    projection.paint(state.camera, state.size.width, state.size.height, acknowledgement.supported);
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
