import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import {
  DEFAULT_REFLECTION_SIZE,
  OCEAN_NORMALS_URL,
  OCEAN_SIZE,
  OCEAN_TIME_SPEED,
  OceanTheme,
  getOceanSurfaceConfig,
} from './ocean/oceanConfig';
import { isFrameDrawn } from '@/lib/render/frameGate';

interface OceanProps {
  theme: OceanTheme;
  position?: [number, number, number];
  /** Edge of the reflection render target. See the GPU tier budget. */
  reflectionSize?: number;
}

export function Ocean({
  theme,
  position = [0, -4, 0],
  reflectionSize = DEFAULT_REFLECTION_SIZE,
}: OceanProps) {
  const waterRef = useRef<Water | null>(null);

  const waterNormals = useLoader(THREE.TextureLoader, OCEAN_NORMALS_URL);

  const geometry = useMemo(() => new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE), []);

  const waterConfig = useMemo(
    () => ({
      ...getOceanSurfaceConfig(theme, reflectionSize),
      waterNormals,
    }),
    [theme, waterNormals, reflectionSize]
  );

  const water = useMemo(() => {
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;

    const surface = new Water(geometry, waterConfig);
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = true;

    return surface;
  }, [geometry, waterConfig, waterNormals]);

  useEffect(() => {
    waterRef.current = water;

    return () => {
      waterRef.current = null;
      if (water.material) {
        water.material.dispose();
      }
      geometry.dispose();
    };
  }, [water, geometry]);

  useEffect(() => {
    const current = waterRef.current;
    if (current && current.material && current.material.uniforms) {
      const isLight = theme === 'light';
      current.material.uniforms.sunColor.value.setHex(isLight ? 0xffffff : 0x8fffe2);
      current.material.uniforms.waterColor.value.setHex(isLight ? 0x2f8db8 : 0x04303a);
      current.material.uniforms.distortionScale.value = isLight ? 2.8 : 2.25;
      current.material.uniforms.alpha.value = isLight ? 0.92 : 0.95;
      current.material.uniforms.size.value = isLight ? 1.0 : 1.45;
      current.material.transparent = true;
    }
  }, [theme]);

  useFrame((state, delta) => {
    // Advancing the swell on a frame that is never drawn spends the reflection
    // pass on an image no one sees. The clock is driven by delta, so it
    // catches up exactly on the next frame that is.
    if (!isFrameDrawn(state.clock.getElapsedTime())) return;

    const current = waterRef.current;
    if (current && current.material && current.material.uniforms && current.material.uniforms.time) {
      current.material.uniforms.time.value += delta * OCEAN_TIME_SPEED;
    }
  });

  return <primitive object={water} position={position} />;
}
