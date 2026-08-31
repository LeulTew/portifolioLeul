import * as THREE from 'three';

export type OceanTheme = 'light' | 'dark';

export const OCEAN_SIZE = 1400;
export const OCEAN_NORMALS_URL = '/images/waternormals.jpg';

/**
 * Distance to the island's coastline, baked from the terrain itself.
 *
 * See scripts/bake-shore-field.mjs. Regenerate it whenever the terrain mesh
 * or its placement changes, or the surf will break on the old coast.
 */
export const SHORE_FIELD_URL = '/images/shore-field.png';
export const OCEAN_TIME_SPEED = 0.29;

const COMMON_WATER_COLOR = {
  distortionScale: 2.8,
  alpha: 0.92,
  sunDirection: new THREE.Vector3(0.35, 0.9, 0.25).normalize(),
  sunColor: new THREE.Color(0xffffff),
};

const OCEAN_THEME_COLORS: Record<OceanTheme, THREE.Color> = {
  light: new THREE.Color('#2f8db8'),
  dark: new THREE.Color('#04303a'),
};

/**
 * Default edge of the reflection render target.
 *
 * The water renders the entire scene a second time into this target on every
 * drawn frame, so its area is a direct multiplier on the page's GPU cost.
 */
export const DEFAULT_REFLECTION_SIZE = 512;

export function getOceanSurfaceConfig(
  theme: OceanTheme,
  reflectionSize: number = DEFAULT_REFLECTION_SIZE
) {
  const isDark = theme === 'dark';

  return {
    textureWidth: reflectionSize,
    textureHeight: reflectionSize,
    distortionScale: isDark ? 2.25 : COMMON_WATER_COLOR.distortionScale,
    alpha: isDark ? 0.95 : COMMON_WATER_COLOR.alpha,
    sunDirection: COMMON_WATER_COLOR.sunDirection,
    sunColor: COMMON_WATER_COLOR.sunColor,
    waterColor: OCEAN_THEME_COLORS[theme],
    fog: true,
    format: THREE.RGBAFormat,
  };
}
