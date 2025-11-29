import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  useScroll, 
  Environment, 
  MeshReflectorMaterial,
  useGLTF,
  PerspectiveCamera,
  Points,
  PointMaterial
} from '@react-three/drei';
import * as THREE from 'three';
import { Theme } from './sections/theme/ThemeContext';
import { MeModel } from './MeModel';

// Preload the terrain model
useGLTF.preload('/models/terrain-1k.glb');

interface TerrainProps {
  surfaceColor: string;
}

function Terrain({ surfaceColor }: TerrainProps) {
  const { scene } = useGLTF('/models/terrain-1k.glb');
  
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
}

function Particles({ color }: ParticlesProps) {
  const count = 1000;
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return positions;
  }, []);

  return (
    <Points>
      <PointMaterial
        transparent
        vertexColors
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

interface BackgroundSceneProps {
  theme: Theme;
}

export function BackgroundScene({ theme }: BackgroundSceneProps) {
  const sceneRef = useRef<THREE.Group>(null);
  const prismRef = useRef<THREE.Group>(null);
  const scroll = useScroll();
  const palette = useMemo(() => {
    const isLight = theme === 'light';
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
  }, [theme]);
  const prismAppearance = useMemo(() => {
    return theme === 'light'
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
  }, [theme]);

  useFrame((state) => {
    if (!sceneRef.current || !prismRef.current) return;

    const time = state.clock.getElapsedTime();
    const scrollProgress = scroll.offset;

    // Scene parallax based on mouse
    const mouseX = state.mouse.x * 0.3;
    const mouseY = state.mouse.y * 0.2;
    sceneRef.current.rotation.y = mouseX * 0.2 + scrollProgress * Math.PI;
    sceneRef.current.rotation.x = mouseY * 0.1;

    // Prism animation
    prismRef.current.position.y = Math.sin(time * 0.5) * 0.2 + 2;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 30]} fov={50} near={0.1} far={1000} />
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 30, 70]} />

      <group ref={sceneRef}>
        <Environment preset={palette.environment} />

        {/* Reflective Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]} receiveShadow>
          <planeGeometry args={[500, 500]} />
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={1024}
            mixBlur={0.5}
            mixStrength={10}
            roughness={0.6}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color={palette.ground}
            metalness={0.9}
            mirror={0.75}
          />
        </mesh>

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
            {theme === 'light' ? (
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
              opacity={theme === 'light' ? 0.25 : 0.4}
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

        {/* Ambient Particles */}
        <Particles color={palette.highlight} />

        <Suspense fallback={null}>
          {/* Placed next to the prism [12, 2, -15] */}
          {/* Adjusted Y to be on ground (-4) */}
          <MeModel 
            position={[18, 1.8, -15]} 
            scale={[7, 7, 7]} 
            rotation={[0, -Math.PI / 2.2, 0]} 
          />
        </Suspense>

        {/* Enhanced Lighting */}
        <ambientLight intensity={palette.ambient} />
        <directionalLight 
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