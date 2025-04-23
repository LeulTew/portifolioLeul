import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import { Group } from 'three';

interface SceneProps {
  children?: React.ReactNode;
}

export default function Scene({ children }: SceneProps) {
  const groupRef = useRef<Group>(null);
  const scroll = useScroll();

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Rotate based on scroll
    const scrollOffset = scroll.offset;
    groupRef.current.rotation.y = scrollOffset * Math.PI * 2;
    
    // Tilt based on scroll
    groupRef.current.rotation.x = Math.sin(scrollOffset * Math.PI) * 0.2;
  });

  return (
    <group ref={groupRef}>
      {children}
    </group>
  );
}