import { useEffect, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { invalidateStillWorld } from '@/lib/render/frameGate';
import { precompileWorld } from '@/lib/render/precompileWorld';
import {
  beginWorldCompile, isWorldHeld, registerScene, setSceneReady, setWorldCompiled,
} from '@/lib/render/sceneReady';
import { PrefetchedModel } from './PrefetchedModel';

/**
 * Reports when the world is genuinely up.
 *
 * It asks for every resource the opening shot needs, so it suspends until the
 * last of them has been decoded -- not merely downloaded. Each probe uses the
 * scene's individual URL cache key. An array key is a different R3F resource:
 * it parses every model again even when FileLoader already has its bytes.
 *
 * Then it compiles every material off the main thread, and the world is not
 * drawn until that is done: a program compiled on first draw stalls the page
 * until the GPU has finished it (round 31). The first frame after is drawn with
 * nothing left to stall on, and that is when the world reports itself up.
 *
 * Mount it inside the Canvas, wrapped in Suspense, alongside the scene.
 */

export interface SceneReadyProps {
  /** Every URL the first view cannot be drawn without. */
  models: readonly string[];
  textures: readonly string[];
}

type Phase = 'resourced' | 'compiling' | 'compiled' | 'announced';

export function SceneReady({ models, textures }: SceneReadyProps) {
  // Registered before suspending, so the loader knows a world is coming and
  // waits for it rather than opening on an empty sea.
  registerScene();

  const phase = useRef<Phase>('resourced');

  useEffect(() => {
    registerScene();
  }, []);

  useFrame(({ gl, scene, camera }) => {
    if (phase.current === 'announced') return;
    if (phase.current === 'resourced') {
      phase.current = 'compiling';
      beginWorldCompile();
      const compiled = () => {
        setWorldCompiled();
        invalidateStillWorld();
        if (phase.current === 'compiling') phase.current = 'compiled';
      };
      precompileWorld(gl, scene, camera).then(compiled, compiled);
      return;
    }
    // Still compiling, within its allowance: the world stays undrawn and the loader up.
    if (phase.current === 'compiling' && isWorldHeld()) return;
    phase.current = 'announced';
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
