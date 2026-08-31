import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Theme } from './sections/theme/ThemeContext';
import { isFrameDrawn } from '@/lib/render/frameGate';

interface ParticleBackgroundProps {
  theme: Theme;
  /** Instance count, normally taken from the GPU tier budget. */
  count?: number;
}

/** Used when the caller has no GPU-tier reading yet. */
const DEFAULT_COUNT = 800;

/**
 * Vertical drift amplitude, in world units.
 *
 * Matches what the old per-frame loop actually produced. That loop integrated
 * `sin(t) * 0.001` into the position every frame, which at its drift rate
 * settles into an oscillation of roughly this size -- so the field looks the
 * same, it is simply no longer computed one vertex at a time on the CPU.
 */
const DRIFT_AMPLITUDE = 0.006;

const ParticleBackground = ({ theme, count = DEFAULT_COUNT }: ParticleBackgroundProps) => {
  const particlesRef = useRef<THREE.Points>(null);
  const isLight = theme === 'light';

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const mixedColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 50;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 50;

      // Vary the size of particles
      sizes[i] = Math.random() * 0.2;

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

  /**
   * Shared with the vertex shader, which does the drifting.
   *
   * The field used to be animated on the CPU: a loop over every vertex, then
   * the whole position buffer re-uploaded to the GPU, on every frame. At the
   * old count that was six thousand float writes and a 24KB transfer per
   * frame, to move each mote by a fraction of a pixel. The same displacement
   * costs nothing as a term in the vertex shader, and the geometry becomes
   * static -- uploaded once, never touched again.
   */
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDrift: { value: DRIFT_AMPLITUDE },
    }),
    []
  );

  useFrame((state) => {
    const points = particlesRef.current;
    if (!points) return;

    const time = state.clock.elapsedTime;
    if (!isFrameDrawn(time)) return;

    // Slow rotation
    points.rotation.y = time * 0.05;
    uniforms.uTime.value = time;
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
        uniforms={uniforms}
        vertexShader={`
          attribute float size;
          uniform float uTime;
          uniform float uDrift;
          varying vec3 vColor;

          void main() {
            vColor = color;

            // Seeded off x so neighbouring motes drift out of step, which is
            // what the CPU version got for free by reading each position.
            vec3 drifted = position;
            drifted.y += sin(uTime * 0.2 + position.x) * uDrift;

            vec4 mvPosition = modelViewMatrix * vec4(drifted, 1.0);
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
