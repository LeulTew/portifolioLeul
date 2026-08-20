import { useRef, useMemo, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  useScroll, 
  Environment, 
  useGLTF,
  PerspectiveCamera
} from '@react-three/drei';
import * as THREE from 'three';
import { Theme } from './sections/theme/ThemeContext';
import { MeModel } from './MeModel';
import { TVModel } from './TVModel';
import { Ocean } from './Ocean';
import { ShorelineBreak } from './ocean/ShorelineBreak';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';

const TERRAIN_URL = '/models/terrain-mobile.glb';

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


function ResponsiveTV() {
  return (
    <TVModel 
      position={[-22, 1, -15]} 
      scale={[8, 8, 8]} 
      rotation={[0, Math.PI / 1.5, 0]} 
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

export function BackgroundScene({ theme }: BackgroundSceneProps) {
  const sceneRef = useRef<THREE.Group>(null);
  const prismRef = useRef<THREE.Group>(null);
  const scroll = useScroll();

  const isLight = theme === 'light';

  const palette = useMemo(() => {
    return {
      background: isLight ? '#f4f7ff' : '#001414',
      fog: isLight ? '#f6f8ff' : '#001414',
      terrain: isLight ? '#e9e2d4' : '#0e2424',
      ground: isLight ? '#3a5f5f' : '#001414',
      highlight: '#00ff9d',
      rimLight: '#00ff9d',
      environment: (isLight ? 'city' : 'night') as 'city' | 'night',
      ambient: isLight ? 0.65 : 0.45,
      directional: isLight ? 1.15 : 0.95,
      directionalColor: isLight ? '#ffffff' : '#e6fff5',
      spotIntensity: isLight ? 0.8 : 1.35,
      spotColor: '#00ff9d',
      pointIntensity: isLight ? 4 : 5.8,
      islandFillLight: isLight ? 0.3 : 0.6,
      characterLight: isLight ? 2.5 : 4.5,
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

  const smoothedMouse = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (!sceneRef.current || !prismRef.current) return;

    const time = state.clock.getElapsedTime();
    const scrollProgress = scroll?.offset ?? 0;
    const reducedMotion = getPrefersReducedMotion();

    // Inertial damping lerp on normalized cursor coordinates
    const targetX = reducedMotion ? 0 : state.mouse.x;
    const targetY = reducedMotion ? 0 : state.mouse.y;
    const lerpFactor = Math.min(1, delta * 4);

    smoothedMouse.current.x = THREE.MathUtils.lerp(smoothedMouse.current.x, targetX, lerpFactor);
    smoothedMouse.current.y = THREE.MathUtils.lerp(smoothedMouse.current.y, targetY, lerpFactor);

    // Scene rotation parallax
    sceneRef.current.rotation.y = smoothedMouse.current.x * 0.12 + scrollProgress * Math.PI;
    sceneRef.current.rotation.x = smoothedMouse.current.y * 0.06;

    // Subtle 3D camera spatial parallax offset
    if (!reducedMotion && state.camera) {
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, smoothedMouse.current.x * 1.8, Math.min(1, delta * 2.5));
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, 5 + smoothedMouse.current.y * 1.2, Math.min(1, delta * 2.5));
    }

    // Neon prism floating animation
    prismRef.current.position.y = reducedMotion ? 2 : Math.sin(time * 0.5) * 0.2 + 2;
  });

  return (
    <>
      <ResponsiveCamera />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 35, 75]} />

      <group ref={sceneRef}>
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



        <Suspense fallback={null}>
          {/* Character Model */}
          <MeModel 
            position={[22, -2.5, -15]} 
            scale={[8, 8, 8]} 
            rotation={[0, Math.PI / 0.55, 0]} 
          />
          
          {/* TV Model with Video */}
          <ResponsiveTV />
        </Suspense>

        {/* Enhanced Cinematic Lighting */}
        <ambientLight intensity={palette.ambient} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={palette.directional} 
          color={palette.directionalColor} 
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
        
        {/* Island & CRT TV Fill Light */}
        <pointLight
          position={[-4, 4, -10]}
          intensity={palette.islandFillLight}
          color={palette.highlight}
          distance={30}
          decay={2}
        />

        {/* Dedicated Character Key/Rim Light for crisp silhouette and body details */}
        <pointLight
          position={[20, 1, -11]}
          intensity={palette.characterLight}
          color={isLight ? '#ffffff' : '#e0fff4'}
          distance={22}
          decay={1.8}
        />
      </group>
    </>
  );
}