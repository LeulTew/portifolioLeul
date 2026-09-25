import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { OwnedWater } from '@/lib/ocean/OwnedWater';
import {
  DEFAULT_REFLECTION_SIZE,
  OCEAN_NORMALS_URL,
  OCEAN_SIZE,
  OCEAN_TIME_SPEED,
  OceanTheme,
  SHORE_FIELD_URL,
  getOceanSurfaceConfig,
} from './ocean/oceanConfig';
import {
  DEFAULT_OCEAN_GEOMETRY,
  createOceanGeometry,
} from '@/lib/ocean/oceanGeometry';
import { DEFAULT_WAVE_SETTINGS, applyWaveShader, maxWaveHeight } from './ocean/waveShader';
import { drawnFrameDelta, isFrameDrawn } from '@/lib/render/frameGate';
import { createReflectionCadence } from '@/lib/render/reflectionCadence';
import { usePrefersReducedMotion } from '@/lib/gateways/animationGateway';

interface OceanProps {
  theme: OceanTheme;
  position?: [number, number, number];
  /** Edge of the reflection render target. See the GPU tier budget. */
  reflectionSize?: number;
  reflectionFps?: number;
  /** Segments around the island. See the GPU tier budget. */
  segments?: number;
  /** Rings out from the island. See the GPU tier budget. */
  rings?: number;
}

/**
 * Where the island sits in the water plane's own local space.
 *
 * The plane is laid flat by a -90 degree rotation about X, which maps local
 * (x, y) onto world (x, -z). The island's world z of -20 is therefore a local
 * y of +20. Get this wrong and the detailed rings are packed around open
 * water while the coast is drawn with the coarse ones.
 */
const ISLAND_IN_PLANE_SPACE: readonly [number, number] = [0, 20];

export function Ocean({
  theme,
  position = [0, -4, 0],
  reflectionSize = DEFAULT_REFLECTION_SIZE,
  reflectionFps = 0,
  segments = DEFAULT_OCEAN_GEOMETRY.radialSegments,
  rings = DEFAULT_OCEAN_GEOMETRY.rings,
}: OceanProps) {
  const container = useMemo(() => new THREE.Group(), []);
  const waterRef = useRef<OwnedWater | null>(null);
  const renderTime = useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  const waterNormals = useLoader(THREE.TextureLoader, OCEAN_NORMALS_URL);
  const shoreField = useLoader(THREE.TextureLoader, SHORE_FIELD_URL);

  useLayoutEffect(() => {
    // Allocate after commit: useMemo can abandon undisposed instances during
    // StrictMode's render replay or a suspended render.
    const geometry = createOceanGeometry(ISLAND_IN_PLANE_SPACE, {
      ...DEFAULT_OCEAN_GEOMETRY,
      radialSegments: segments,
      rings,
      outerRadius: OCEAN_SIZE / 2,
    });
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;

    /*
     * The shore field is data, not a picture.
     *
     * It must not be colour-managed -- an sRGB decode would bend the distances
     * it encodes -- and it must not be flipped, because row zero of the baked
     * image is the minimum world z. Clamping is what makes the water beyond
     * the field simply deep, rather than wrapping the island around the
     * horizon.
     */
    shoreField.colorSpace = THREE.NoColorSpace;
    shoreField.flipY = false;
    shoreField.wrapS = THREE.ClampToEdgeWrapping;
    shoreField.wrapT = THREE.ClampToEdgeWrapping;
    shoreField.minFilter = THREE.LinearFilter;
    shoreField.magFilter = THREE.LinearFilter;
    shoreField.generateMipmaps = false;
    shoreField.needsUpdate = true;

    const surface = new OwnedWater(geometry, {
      ...getOceanSurfaceConfig('dark', reflectionSize),
      waterNormals,
      crestHeight: maxWaveHeight(DEFAULT_WAVE_SETTINGS),
    });
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = true;

    applyWaveShader(surface.material as THREE.ShaderMaterial, {
      shoreField,
      settings: DEFAULT_WAVE_SETTINGS,
    });
    if (reflectionFps > 0) {
      const due = createReflectionCadence(reflectionFps);
      const reflect = surface.onBeforeRender;
      surface.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        if (due(renderTime.current)) reflect.call(surface, renderer, scene, camera, geometry, material, group);
      };
    }

    // Attach during this commit so the later <Preload all /> sees the water,
    // without a state update that would defer its mesh to a second commit.
    container.add(surface);
    waterRef.current = surface;
    return () => {
      container.remove(surface);
      waterRef.current = null;
      surface.dispose();
      geometry.dispose();
    };
  }, [container, segments, rings, reflectionSize, waterNormals, shoreField, reflectionFps]);

  useLayoutEffect(() => {
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
  });

  useFrame((state, delta) => {
    renderTime.current = state.clock.elapsedTime;
    // Advancing the swell on a frame that is never drawn spends the reflection
    // pass on an image no one sees. The clock is driven by delta, so it
    // catches up exactly on the next frame that is.
    if (!isFrameDrawn(state.clock.elapsedTime) || reducedMotion) return;

    const current = waterRef.current;
    if (current && current.material && current.material.uniforms && current.material.uniforms.time) {
      current.material.uniforms.time.value +=
        Math.min(drawnFrameDelta(state.clock.elapsedTime, delta), 0.1) * OCEAN_TIME_SPEED;
    }
  });

  return <primitive object={container} position={position} dispose={null} />;
}
