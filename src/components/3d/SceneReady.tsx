import { useEffect, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerScene, setSceneReady } from '@/lib/render/sceneReady';

/**
 * Reports when the world is genuinely up.
 *
 * It asks for every resource the opening shot needs, so it suspends until the
 * last of them has been decoded -- not merely downloaded. drei memoises loads
 * by URL, so asking again costs a map lookup, not a second fetch.
 *
 * Then it waits one drawn frame. Materials compile the first time they are
 * rendered, and `<Preload all />` does that compiling up front, so a frame
 * having been drawn is the point at which there is nothing left to stall on.
 *
 * Mount it inside the Canvas, wrapped in Suspense, alongside the scene.
 */

export interface SceneReadyProps {
  /** Every URL the first view cannot be drawn without. */
  models: readonly string[];
  textures: readonly string[];
}

export function SceneReady({ models, textures }: SceneReadyProps) {
  // Registered before suspending, so the loader knows a world is coming and
  // waits for it rather than opening on an empty sea.
  registerScene();

  // Suspends here until each one has been parsed.
  useGLTF(models as string[], false);
  useLoader(THREE.TextureLoader, textures as string[]);

  const announced = useRef(false);

  useEffect(() => {
    registerScene();
  }, []);

  useFrame(() => {
    if (announced.current) return;
    announced.current = true;
    setSceneReady();
  });

  return null;
}
