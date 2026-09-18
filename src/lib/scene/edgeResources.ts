import * as THREE from 'three';
import { getOceanSurfaceConfig, type OceanTheme } from '@/components/ocean/oceanConfig';
import {
  createHorizonGeometry,
  createTerrainSkirtGeometry,
  HORIZON_INNER_RADIUS,
  HORIZON_OUTER_RADIUS,
} from './edgeGeometry';
import { createTerrainContinuation } from './terrainContinuation';
import { TERRAIN_RIM, TERRAIN_SOFTWARE_RIM } from './terrainRim';

export const HORIZON_LAYER = 1;

function terrainAppearance(terrain: THREE.Object3D): THREE.MeshStandardMaterial {
  let appearance: THREE.MeshStandardMaterial | undefined;
  terrain.traverse((object) => {
    if (appearance || !(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    appearance = materials.find(
      (material): material is THREE.MeshStandardMaterial =>
        material instanceof THREE.MeshStandardMaterial && material.map !== null
    );
  });
  if (!appearance) throw new Error('Scene edges require the mounted terrain albedo material.');
  return appearance;
}

export function createEdgeResources(
  terrain: THREE.Object3D, theme: OceanTheme = 'light', softwareRenderer = false,
) {
  const appearance = terrainAppearance(terrain);
  const skirtMaterial = new THREE.MeshStandardMaterial({
    name: 'terrain-edge-material',
    color: appearance.color,
    map: appearance.map,
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    envMapIntensity: appearance.envMapIntensity,
    vertexColors: true,
    flatShading: true,
    transparent: false,
    fog: true,
  });
  const horizonMaterial = new THREE.ShaderMaterial({
    name: 'ocean-horizon-material',
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      backgroundColor: { value: new THREE.Color() },
      waterAlpha: { value: getOceanSurfaceConfig(theme).alpha },
      radii: {
        value: new THREE.Vector2(HORIZON_INNER_RADIUS, HORIZON_OUTER_RADIUS),
      },
    },
    vertexShader: /* glsl */ `
      attribute float horizonRadius;
      varying float vHorizonRadius;
      varying float vViewDepth;
      void main() {
        vHorizonRadius = horizonRadius;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDepth = -viewPosition.z;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      uniform vec3 backgroundColor;
      uniform float fogFar;
      uniform float waterAlpha;
      uniform vec2 radii;
      varying float vHorizonRadius;
      varying float vViewDepth;
      void main() {
        if (vViewDepth < fogFar) discard;
        float fade = smoothstep(radii.x, radii.y, vHorizonRadius) *
          smoothstep(fogFar, fogFar + 12.0, vViewDepth);
        // Three's fog uniform is already output-encoded, after water's tone map.
        // Encode only the linear background, like WebGLBackground's clear color.
        vec3 background = linearToOutputTexel(vec4(backgroundColor, 1.0)).rgb;
        vec3 distantWater = mix(background, fogColor, waterAlpha);
        gl_FragColor = vec4(mix(distantWater, background, fade), 1.0);
      }
    `,
    fog: true,
    toneMapped: false,
    transparent: false,
    depthWrite: true,
    // At 700 units a 0.02-unit lift can share a depth-buffer value with Water.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });

  const skirt = new THREE.Mesh(createTerrainSkirtGeometry(softwareRenderer), skirtMaterial);
  skirt.name = 'terrain-edge-skirt';
  const land = new THREE.Mesh(
    createTerrainContinuation(softwareRenderer ? TERRAIN_SOFTWARE_RIM : TERRAIN_RIM), skirtMaterial,
  );
  land.name = 'terrain-land-continuation';
  const horizon = new THREE.Mesh(createHorizonGeometry(), horizonMaterial);
  horizon.name = 'ocean-horizon-continuation';
  horizon.layers.set(HORIZON_LAYER);

  let disposed = false;
  return {
    skirt,
    land,
    horizon,
    dispose() {
      if (disposed) return;
      disposed = true;
      skirt.geometry.dispose();
      land.geometry.dispose();
      horizon.geometry.dispose();
      skirtMaterial.dispose();
      horizonMaterial.dispose();
      // Terrain owns the borrowed map; neither its map nor cached GLTF is ours.
    },
  };
}

export function bindHorizonBackground(material: THREE.ShaderMaterial, scene: THREE.Scene) {
  if (!(scene.background instanceof THREE.Color) ||
      !(scene.fog instanceof THREE.Fog)) {
    throw new Error('Scene horizon requires the existing solid background and fog.');
  }
  material.uniforms.backgroundColor.value = scene.background;
}

/** Water owns a separate, default-layer mirror camera; only the main view opts in. */
export function enableHorizonLayer(camera: THREE.Camera): () => void {
  const alreadyEnabled = camera.layers.isEnabled(HORIZON_LAYER);
  camera.layers.enable(HORIZON_LAYER);
  return () => {
    if (!alreadyEnabled) camera.layers.disable(HORIZON_LAYER);
  };
}
