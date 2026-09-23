import { useRef, useMemo, useEffect, Suspense, Component, type ReactNode } from 'react';
import {
  useGLTF,
  PerspectiveCamera,
  Points,
  PointMaterial
} from '@react-three/drei';
import * as THREE from 'three';
import { Theme } from './sections/theme/ThemeContext';
import { MeModel } from './MeModel';
import { TVModel } from './TVModel';
import { Ocean } from './Ocean';
import { CinematicCameraController } from './3d/CinematicCameraController';
import { AtmosphericDrift } from './3d/AtmosphericDrift';
import { ChapterGrading } from './3d/ChapterGrading';
import { ContactSky } from './3d/ContactSky';
import { LocalEnvironment } from './3d/LocalEnvironment';
import { SceneReady } from './3d/SceneReady';
import { PrefetchedModel } from './3d/PrefetchedModel';
import { SceneEdgeContinuity } from './3d/SceneEdgeContinuity';
import { GreenPrism } from './3d/GreenPrism';
import {
  getCriticalModels,
  resolveSceneModel,
  CRITICAL_SCENE_TEXTURES,
} from '@/lib/assets/criticalAssets';
import { getGpuTier } from '@/lib/gateways/gpuTier';
import { DEFAULT_REFLECTION_SIZE } from './ocean/oceanConfig';
import { TV_POSITION, TV_ROTATION, TV_SCALE } from '@/lib/projects/tvScreen';
import { AVATAR_POSITION, AVATAR_ROTATION, AVATAR_SCALE } from '@/lib/avatar/avatarCamera';

const TERRAIN_URL = '/models/terrain-opt.glb';

/**
 * Draco is deliberately off for every model on this page.
 *
 * drei fetches the Draco decoder from gstatic.com on first use, so a
 * Draco-compressed model cannot begin decoding until a third-party request
 * completes -- and Draco then decodes several times slower than meshopt, on
 * the main thread. Every model here is re-encoded with meshopt, whose decoder
 * ships inside three-stdlib and is already in the bundle.
 */
const NO_DRACO = false;

/** Used when the caller has no GPU-tier reading yet. */
const DEFAULT_PARTICLE_COUNT = 800;

/** Share of the particle budget spent on animated motes rather than stars. */
const DRIFT_BUDGET_SHARE = 0.3;


/*
 * Deliberately no useGLTF.preload here.
 *
 * It fires its own request the moment this module is imported, which raced the
 * critical-asset manifest and fetched the model twice -- measured in the
 * browser, and on a slow connection that is the whole download again. The
 * manifest owns preloading now, and it hands the bytes to three's cache, so
 * useGLTF resolves without going near the network. See lib/assets.
 */

interface TerrainProps {
  surfaceColor: string;
  theme: Theme;
}

function Terrain({ surfaceColor, theme }: TerrainProps) {
  const { scene } = useGLTF(resolveSceneModel(TERRAIN_URL), NO_DRACO);
  const softwareRenderer = getGpuTier().softwareRenderer;
  
  const terrain = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: surfaceColor,
          roughness: 0.5,
          metalness: 0.8,
          envMapIntensity: 1.5,
          flatShading: softwareRenderer,
        });
        
        if (child.material.map) {
          const texture = child.material.map.clone();
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.flipY = false;
          material.map = texture;
        }
        
        child.material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, surfaceColor, softwareRenderer]);

  // The clone owns materials/textures, but its geometry belongs to the GLTF cache.
  useEffect(() => {
    return () => {
      terrain.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            if (child.material.map) {
              child.material.map.dispose();
            }
            child.material.dispose();
          }
        }
      });
    };
  }, [terrain]);

  return (
    <>
      <primitive
        object={terrain}
        position={[0, -4, -20]}
        rotation={[0.15, Math.PI, 0]}
        scale={[30, 15, 30]}
        dispose={null}
      />
      <SceneEdgeContinuity terrain={terrain} theme={theme} softwareRenderer={softwareRenderer} />
    </>
  );
}

interface ParticlesProps {
  color: string;
  count: number;
}

function Particles({ color, count }: ParticlesProps) {
  const positions = useMemo(() => {
    const buffer = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      buffer[i * 3] = (Math.random() - 0.5) * 50;
      buffer[i * 3 + 1] = Math.random() * 30;
      buffer[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return buffer;
  }, [count]);

  return (
    <Points>
      <PointMaterial
        transparent
        size={0.15}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color={color}
      />
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
    </Points>
  );
}

function ResponsiveTV({ clips }: { clips: number }) {
  return (
    <TVModel
      clips={clips}
      position={[...TV_POSITION]}
      rotation={[...TV_ROTATION]}
      scale={TV_SCALE}
    />
  );
}

interface SafeTVProps {
  clips: number;
}

interface SafeTVState {
  hasError: boolean;
}

class SafeTV extends Component<SafeTVProps, SafeTVState> {
  constructor(props: SafeTVProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Background TV prop failed to render, omitting:', error);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return <ResponsiveTV clips={this.props.clips} />;
  }
}

function ResponsiveCamera() {
  return (
    <PerspectiveCamera 
      makeDefault 
      position={[0, 5, 30]} 
      fov={50} 
      near={0.1} 
      far={1000} 
    />
  );
}

interface BackgroundSceneProps {
  theme: Theme;
  particleCount?: number;
  /** Edge of the water's reflection target. See the GPU tier budget. */
  reflectionSize?: number;
  reflectionFps?: number;
  /** How many clips the CRT cycles. See the GPU tier budget. */
  videoClips?: number;
  /** Ocean surface resolution. See the GPU tier budget. */
  oceanSegments?: number;
  oceanRings?: number;
}

export function BackgroundScene({
  theme,
  particleCount = DEFAULT_PARTICLE_COUNT,
  reflectionSize = DEFAULT_REFLECTION_SIZE,
  reflectionFps = 0,
  videoClips = 2,
  oceanSegments,
  oceanRings,
}: BackgroundSceneProps) {
  // A fraction of the starfield budget: motes are animated every frame, so they
  // cost far more per instance than the static point cloud.
  const driftCount = Math.max(Math.round(particleCount * DRIFT_BUDGET_SHARE), 0);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);

  const isLight = theme === 'light';

  const palette = useMemo(() => {
    return {
      background: isLight ? '#f4f7ff' : '#001a1a',
      fog: isLight ? '#f6f8ff' : '#001a1a',
      terrain: isLight ? '#e9e2d4' : '#0a1a1a',
      ground: isLight ? '#3a5f5f' : '#001a1a',
      highlight: '#00ff9d',
      ambient: isLight ? 0.6 : 0.2,
      directional: isLight ? 1.1 : 0.5,
      spotIntensity: isLight ? 0.8 : 1,
      spotColor: '#00ff9d',
    };
  }, [isLight]);

  return (
    <>
      <ResponsiveCamera />
      <CinematicCameraController />
      <ChapterGrading isLight={isLight} ambientRef={ambientRef} keyLightRef={keyLightRef} />
      <ContactSky isLight={isLight} />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 30, 70]} />

      <group>
        {/* Holds the loader shut until the world is actually built. */}
        <Suspense fallback={null}>
          <SceneReady models={getCriticalModels()} textures={CRITICAL_SCENE_TEXTURES} />
        </Suspense>

        <LocalEnvironment />

        {/* Realistic Ocean */}
        <Suspense fallback={null}>
          <Ocean
            theme={theme}
            position={[0, -4, 0]}
            reflectionSize={reflectionSize}
            reflectionFps={reflectionFps}
            segments={oceanSegments}
            rings={oceanRings}
          />
        </Suspense>

        <Suspense fallback={null}>
          <PrefetchedModel url={resolveSceneModel(TERRAIN_URL)}>
            <Terrain surfaceColor={palette.terrain} theme={theme} />
          </PrefetchedModel>
        </Suspense>

        <GreenPrism isLight={isLight} />

        {/* Distant starfield */}
        <Particles color={palette.highlight} count={particleCount} />

        {/* Motes drifting through the island's air. The field is placed in
            world space by its own bounds, and motes fade out as the orbiting
            camera passes through them. */}
        <AtmosphericDrift
          count={driftCount}
          color={palette.highlight}
          opacity={isLight ? 0.35 : 0.55}
        />

        <Suspense fallback={null}>
          {/* Placed next to the prism [12, 2, -15] */}
          {/* Adjusted Y to be on ground (-4) */}
          <PrefetchedModel url={resolveSceneModel('/models/me-animated-lite.glb')}>
            <MeModel
              position={[...AVATAR_POSITION]}
              scale={[...AVATAR_SCALE]}
              rotation={[...AVATAR_ROTATION]}
            />
          </PrefetchedModel>
          
          {/* TV Model with Video */}
          <SafeTV clips={videoClips} />
        </Suspense>

        {/* Enhanced Lighting */}
        {/* Intensity and colour are cross-faded per chapter by ChapterGrading;
            the palette values below are only the opening state. */}
        <ambientLight ref={ambientRef} intensity={palette.ambient} />
        <directionalLight
          ref={keyLightRef}
          position={[10, 20, 10]}
          intensity={palette.directional}
          color="#ffffff"
          castShadow
        />
        <spotLight
          position={[0, 15, 0]}
          intensity={palette.spotIntensity}
          angle={0.6}
          penumbra={1}
          color={palette.spotColor}
          castShadow
        />
      </group>
    </>
  );
}