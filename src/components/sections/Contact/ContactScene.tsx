import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import { useTheme } from '../theme/useTheme';
import * as THREE from 'three';

export function ContactScene() {
  const { theme } = useTheme();
  const ref = useRef<THREE.Points>(null);
  
  // Create a wave pattern with 3000 points
  const count = 3000;
  const radius = 12;
  const gridSize = Math.sqrt(count);
  const gridStep = (radius * 2) / gridSize;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const color1 = new THREE.Color(theme === 'dark' ? '#4f46e5' : '#6366f1');
  const color2 = new THREE.Color(theme === 'dark' ? '#10b981' : '#34d399');

  for (let i = 0; i < count; i++) {
    const x = (i % gridSize - gridSize / 2) * gridStep;
    const z = (Math.floor(i / gridSize) - gridSize / 2) * gridStep;
    const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 2;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Create a gradient effect
    const mixFactor = (x + radius) / (radius * 2);
    const mixedColor = color1.clone().lerp(color2, mixFactor);

    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;
  }

  useFrame((state) => {
    if (!ref.current) return;

    const time = state.clock.getElapsedTime() * 0.5;
    
    // Update positions for wave animation
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const x = positions[i3];
      const z = positions[i3 + 2];
      
      positions[i3 + 1] = Math.sin(x * 0.5 + time) * Math.cos(z * 0.5 + time) * 2;
    }
    
    ref.current.geometry.attributes.position.needsUpdate = true;

    // Add subtle rotation
    ref.current.rotation.y = Math.sin(time * 0.2) * 0.1;
    ref.current.rotation.z = Math.cos(time * 0.2) * 0.1;
  });

  return (
    <>
      <color attach="background" args={[theme === 'dark' ? '#000000' : '#ffffff']} />
      <Points ref={ref}>
        <PointMaterial
          transparent
          vertexColors
          size={0.025}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
            needsUpdate={true}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
      </Points>
      
      {/* Add subtle ambient and directional lighting */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[10, 10, 5]} intensity={0.2} />
    </>
  );
} 