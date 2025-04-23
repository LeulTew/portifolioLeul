import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import { useTheme } from '../theme/useTheme';
import * as THREE from 'three';

interface ProjectsSceneProps {
  activeProject: number | null;
  isHovered: boolean;
}

export function ProjectsScene({ activeProject, isHovered }: ProjectsSceneProps) {
  const { theme } = useTheme();
  const ref = useRef<THREE.Points>(null);
  
  // Exact number of particles as estudionk.com's projects section
  const count = 5500;
  const radius = 15;
  
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle

    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;

      positions[i * 3] = x * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = z * radius;
    }
    return positions;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;

    // Match estudionk.com's projects section rotation speeds
    const time = state.clock.getElapsedTime() * 0.08;
    ref.current.rotation.x = Math.sin(time * 0.3) * 0.15;
    ref.current.rotation.y = time * 0.2;

    // Match their mouse movement effect
    const mouseX = state.mouse.x * 0.3;
    const mouseY = state.mouse.y * 0.3;
    ref.current.rotation.x += (mouseY - ref.current.rotation.x) * 0.02;
    ref.current.rotation.y += (mouseX - ref.current.rotation.y) * 0.02;

    // Add hover effect
    if (isHovered && activeProject !== null) {
      const scale = THREE.MathUtils.lerp(ref.current.scale.x, 1.2, 0.1);
      ref.current.scale.set(scale, scale, scale);
    } else {
      const scale = THREE.MathUtils.lerp(ref.current.scale.x, 1, 0.1);
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <>
      <color attach="background" args={[theme === 'dark' ? '#000000' : '#ffffff']} />
      <Points ref={ref}>
        <PointMaterial
          transparent
          size={0.02} // Match their exact point size
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexColors={false}
          opacity={0.4} // Match their exact opacity
          color={theme === 'dark' ? '#6366f1' : '#4f46e5'} // Match their exact colors
        />
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
      </Points>
      
      {/* Match their exact lighting setup */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 10, 5]} intensity={0.2} />
    </>
  );
} 