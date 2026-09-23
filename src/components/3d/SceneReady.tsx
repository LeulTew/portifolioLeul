import { useEffect, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { registerScene, setSceneReady } from '@/lib/render/sceneReady';
import { PrefetchedModel } from './PrefetchedModel';

/**
 * Reports when the world is genuinely up.
 *
 * It asks for every resource the opening shot needs, so it suspends until the
 * last of them has been decoded -- not merely downloaded. Each probe uses the
 * scene's individual URL cache key. An array key is a different R3F resource:
 * it parses every model again even when FileLoader already has its bytes.
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

  const announced = useRef(false);

  useEffect(() => {
    registerScene();
  }, []);

  useFrame(() => {
    if (announced.current) return;
    announced.current = true;
    setSceneReady();
  });

  return <>
    {models.map(url => <PrefetchedModel key={url} url={url}><ModelReady url={url} /></PrefetchedModel>)}
    {textures.map(url => <TextureReady key={url} url={url} />)}
  </>;
}

function ModelReady({ url }: { url: string }) {
  useGLTF(url, false);
  return null;
}

function TextureReady({ url }: { url: string }) {
  useLoader(THREE.TextureLoader, url);
  return null;
}
