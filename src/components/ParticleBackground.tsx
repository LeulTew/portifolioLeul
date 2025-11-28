import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Theme } from './sections/theme/ThemeContext';

interface ParticleBackgroundProps {
  theme: Theme;
}

const ParticleBackground = ({ theme }: ParticleBackgroundProps) => {
  const count = 2000;
  const particlesRef = useRef<THREE.Points>(null);
  const isLight = theme === 'light';

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 50;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 50;

      // Vary the size of particles
      sizes[i] = Math.random() * 0.2;

      const mixedColor = new THREE.Color();
      const baseHue = isLight ? 0.08 : 0.4;
      const baseLightness = isLight ? 0.6 : 0.3;
      mixedColor.setHSL(
        baseHue + Math.random() * (isLight ? 0.04 : 0.1),
        isLight ? 0.65 : 0.8,
        baseLightness + Math.random() * (isLight ? 0.2 : 0.15)
      );
      
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }

    return {
      positions,
      sizes,
      colors,
    };
  }, [count, isLight]);

  useFrame((state) => {
    if (!particlesRef.current) return;

    // Slow rotation
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;

    // Make particles move slightly
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count * 3; i += 3) {
      positions[i + 1] += Math.sin(state.clock.elapsedTime * 0.2 + positions[i]) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={particles.sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        vertexColors
        vertexShader={`
          attribute float size;
          varying vec3 vColor;

          void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;

          void main() {
            float strength = distance(gl_PointCoord, vec2(0.5));
            strength = 1.0 - strength;
            strength = pow(strength, 3.0);

            vec3 finalColor = mix(vec3(0.0), vColor, strength);
            gl_FragColor = vec4(finalColor, strength);
          }
        `}
      />
    </points>
  );
};

export default ParticleBackground; 