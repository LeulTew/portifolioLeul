import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { Mesh } from 'three';

export function Cube() {
  const meshRef = useRef<Mesh>(null);
  const { progress } = useProgress();

  useEffect(() => {
    console.log('Basic cube loading progress:', progress);
  }, [progress]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial
        color="#0ea5e9"
        wireframe
        transparent
        opacity={0.2}
      />
    </mesh>
  );
}