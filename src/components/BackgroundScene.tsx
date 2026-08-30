import { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  Environment, 
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
import { ShorelineBreak } from './ocean/ShorelineBreak';
import { CinematicCameraController } from './3d/CinematicCameraController';
import { AtmosphericDrift } from './3d/AtmosphericDrift';
import { DRIFT_FIELD_ORIGIN } from '@/lib/atmosphere/drift';
import { ChapterGrading } from './3d/ChapterGrading';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

const TERRAIN_URL = '/models/terrain-mobile.glb';

/** Used when the caller has no GPU-tier reading yet. */
const DEFAULT_PARTICLE_COUNT = 800;

/** Share of the particle budget spent on animated motes rather than stars. */
const DRIFT_BUDGET_SHARE = 0.3;


useGLTF.preload('/models/terrain-mobile.glb');

interface TerrainProps {
  surfaceColor: string;
}

function Terrain({ surfaceColor }: TerrainProps) {
  const { scene } = useGLTF(TERRAIN_URL);
  
  const terrain = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: surfaceColor,
          roughness: 0.5,
          metalness: 0.8,
          envMapIntensity: 1.5,
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
  }, [scene, surfaceColor]);

  // Clean up cloned terrain mesh, material, and textures on unmount
  useEffect(() => {
    return () => {
      terrain.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
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
    <primitive 
      object={terrain} 
      position={[0, -4, -20]}
      rotation={[0.15, Math.PI, 0]}
      scale={[30, 15, 30]}
      dispose={null}
    />
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

function ResponsiveTV() {
  return (
    <TVModel 
      position={[-10, 0.5, -14]} 
      rotation={[0.1, Math.PI * 0.2, 0.1]} 
      scale={[8, 8, 8]} 
    />
  );
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
}

export function BackgroundScene({ theme, particleCount = DEFAULT_PARTICLE_COUNT }: BackgroundSceneProps) {
  // A fraction of the starfield budget: motes are animated every frame, so they
  // cost far more per instance than the static point cloud.
  const driftCount = Math.max(Math.round(particleCount * DRIFT_BUDGET_SHARE), 0);
  const prismRef = useRef<THREE.Group>(null);
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
      environment: (isLight ? 'city' : 'night') as 'city' | 'night',
      ambient: isLight ? 0.6 : 0.2,
      directional: isLight ? 1.1 : 0.5,
      spotIntensity: isLight ? 0.8 : 1,
      spotColor: '#00ff9d',
      pointIntensity: isLight ? 4 : 5,
    };
  }, [isLight]);

  const prismAppearance = useMemo(() => {
    return isLight
      ? {
          solid: '#0a6b4a',
          glow: '#11b978',
          light: '#00d17a',
          emissive: '#04402a',
          opacity: 1,
        }
      : {
          solid: '#00ff9d',
          glow: '#00ff9d',
          light: '#00ff9d',
          emissive: '#004428',
          opacity: 0.9,
        };
  }, [isLight]);

  useFrame((state) => {
    if (!prismRef.current) return;

    const time = state.clock.getElapsedTime();
    const reducedMotion = getPrefersReducedMotion();

    // Parallax now lives on the camera, not on this group: rotating the world
    // to fake it displaced every authored object placement along with it.
    prismRef.current.position.y = reducedMotion ? 2 : Math.sin(time * 0.5) * 0.2 + 2;
  });

  return (
    <>
      <ResponsiveCamera />
      <CinematicCameraController />
      <ChapterGrading isLight={isLight} ambientRef={ambientRef} keyLightRef={keyLightRef} />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 30, 70]} />

      <group>
        <Environment preset={palette.environment} />

        {/* Realistic Ocean */}
        <Suspense fallback={null}>
          <Ocean theme={theme} position={[0, -4, 0]} />
        </Suspense>

        {/* Shore break crest lines where waves meet the island edge */}
        <ShorelineBreak theme={theme} position={[0, -3.92, -20]} />

        <Suspense fallback={null}>
          <Terrain surfaceColor={palette.terrain} />
        </Suspense>

        {/* Neon Prism */}
        <group 
          ref={prismRef} 
          position={[12, 2, -15]}
          rotation={[0, 0, -0.3]}
        >
          {/* Main prism body */}
          <mesh scale={[0.3, 12, 0.3]} castShadow>
            <boxGeometry />
            {isLight ? (
              <meshStandardMaterial
                color={prismAppearance.solid}
                metalness={0.15}
                roughness={0.4}
                emissive={prismAppearance.emissive}
                emissiveIntensity={0.4}
                transparent={false}
              />
            ) : (
              <meshBasicMaterial
                color={prismAppearance.solid}
                wireframe={false}
                transparent
                opacity={prismAppearance.opacity}
                blending={THREE.AdditiveBlending}
              />
            )}
          </mesh>
          {/* Outer glow */}
          <mesh scale={[0.4, 12.2, 0.4]}>
            <boxGeometry />
            <meshBasicMaterial
              color={prismAppearance.glow}
              wireframe={true}
              transparent
              opacity={isLight ? 0.25 : 0.4}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight
            intensity={palette.pointIntensity}
            color={prismAppearance.light}
            distance={20}
            decay={2}
            castShadow
          />
        </group>

        {/* Distant starfield */}
        <Particles color={palette.highlight} count={particleCount} />

        {/* Motes drifting through the island's air. Anchored over the island
            and behind the camera's closest approach (z = 8), so no mote can
            cross the lens and read as a large bright shape. */}
        <group position={[...DRIFT_FIELD_ORIGIN]}>
          <AtmosphericDrift
            count={driftCount}
            color={palette.highlight}
            opacity={isLight ? 0.35 : 0.55}
          />
        </group>

        <Suspense fallback={null}>
          {/* Placed next to the prism [12, 2, -15] */}
          {/* Adjusted Y to be on ground (-4) */}
          <MeModel 
            position={[22, -2.5, -15]} 
            scale={[8, 8, 8]} 
            rotation={[0, Math.PI / 0.55, 0]} 
          />
          
          {/* TV Model with Video */}
          <ResponsiveTV />
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