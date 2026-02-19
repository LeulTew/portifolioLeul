import * as THREE from 'three';

export type OceanTheme = 'light' | 'dark';

export const OCEAN_SIZE = 1400;
export const OCEAN_NORMALS_URL = '/images/waternormals.jpg';
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

export function getOceanSurfaceConfig(theme: OceanTheme) {
  const isDark = theme === 'dark';

  return {
    textureWidth: 512,
    textureHeight: 512,
    distortionScale: isDark ? 2.25 : COMMON_WATER_COLOR.distortionScale,
    alpha: isDark ? 0.95 : COMMON_WATER_COLOR.alpha,
    sunDirection: COMMON_WATER_COLOR.sunDirection,
    sunColor: COMMON_WATER_COLOR.sunColor,
    waterColor: OCEAN_THEME_COLORS[theme],
    fog: true,
    format: THREE.RGBAFormat,
  };
}
