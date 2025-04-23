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

// Preload the terrain model
useGLTF.preload('/models/terrain-1k.glb');

function Terrain() {
  const { scene } = useGLTF('/models/terrain-1k.glb');
  
  const terrain = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = new THREE.MeshStandardMaterial({
          color: '#0a1a1a',
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
  }, [scene]);

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

function Particles() {
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
        color="#00ff9d"
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

export function BackgroundScene() {
  const sceneRef = useRef<THREE.Group>(null);
  const prismRef = useRef<THREE.Group>(null);
  const scroll = useScroll();

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
      <color attach="background" args={['#001a1a']} />
      <fog attach="fog" args={['#001a1a', 30, 70]} />

      <group ref={sceneRef}>
        <Environment preset="night" />

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
            color="#001a1a"
            metalness={0.9}
            mirror={0.75}
          />
        </mesh>

        <Suspense fallback={null}>
          <Terrain />
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
            <meshBasicMaterial
              color="#00ff9d"
              wireframe={false}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Outer glow */}
          <mesh scale={[0.4, 12.2, 0.4]}>
            <boxGeometry />
            <meshBasicMaterial
              color="#00ff9d"
              wireframe={true}
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Inner point light */}
          <pointLight
            intensity={5.0}
            color="#00ff9d"
            distance={20}
            decay={2}
          />
        </group>

        {/* Ambient Particles */}
        <Particles />

        {/* Enhanced Lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight 
          position={[10, 20, 10]} 
          intensity={0.5} 
          color="#ffffff" 
          castShadow
        />
        <spotLight
          position={[0, 15, 0]}
          intensity={1.0}
          angle={0.6}
          penumbra={1}
          color="#00ff9d"
          castShadow
        />
      </group>
    </>
  );
} 