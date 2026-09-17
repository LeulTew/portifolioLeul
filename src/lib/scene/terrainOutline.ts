export type TerrainPoint = readonly [x: number, y: number, z: number];

export const TERRAIN_PLACEMENT = {
  position: [0, -4, -20],
  rotation: [0.15, Math.PI, 0],
  scale: [30, 15, 30],
} as const;

export const TERRAIN_HALF_SIZE = 30;
export const TERRAIN_CORE_RADIUS = 23.5;
export const TERRAIN_OUTLINE_VERSION = 1;

/** World-XZ envelopes include the entire contact zones, not just prop origins. */
export const TERRAIN_PROTECTED_REGIONS = [
  { name: 'avatar-feet', minX: 17, maxX: 27, minZ: -20, maxZ: -10 },
  { name: 'tv-cabinet', minX: -15, maxX: -4, minZ: -19, maxZ: -7 },
  { name: 'prism', minX: 9, maxX: 15, minZ: -18, maxZ: -12 },
] as const;

// Counterclockwise from the left: unequal headlands and recesses, not a disc.
const OUTLINE_RADII = [
  27, 29.5, 32, 30, 27, 29.5, 28, 28.5,
  29.7, 32, 34.5, 30, 28.5, 30, 31.5, 28,
];
const COS_TILT = Math.cos(TERRAIN_PLACEMENT.rotation[0]);
const SIN_TILT = Math.sin(TERRAIN_PLACEMENT.rotation[0]);

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Undo the mount's tilt, so height does not masquerade as distance to a border. */
export function terrainPlanarPoint([x, y, z]: TerrainPoint): readonly [number, number] {
  return [x, COS_TILT * (z + 20) - SIN_TILT * (y + 4)];
}

export function terrainSourceRadius(angle: number): number {
  return TERRAIN_HALF_SIZE / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
}

export function terrainInnerRadius(angle: number): number {
  const feet = smoothstep(-0.25, -0.05, angle) * (1 - smoothstep(0.5, 0.8, angle));
  return TERRAIN_CORE_RADIUS + 4.75 * feet;
}

export function terrainOutlineRadius(angle: number): number {
  const station = (angle + Math.PI) / (Math.PI * 2) * OUTLINE_RADII.length;
  const index = Math.floor(station);
  const t = station - index;
  const radius = (offset: number) =>
    OUTLINE_RADII[((index + offset) % OUTLINE_RADII.length + OUTLINE_RADII.length) % OUTLINE_RADII.length];
  const [a, b, c, d] = [radius(-1), radius(0), radius(1), radius(2)];
  const target = 0.5 * (
    2 * b + (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t +
    (-a + 3 * b - 3 * c + d) * t * t * t
  );
  const source = terrainSourceRadius(angle) - 0.2;
  const blend = Math.max(1 - Math.abs(target - source), 0);
  return Math.min(target, source) - blend * blend / 4;
}

export function isProtectedTerrainTriangle(
  a: TerrainPoint, b: TerrainPoint, c: TerrainPoint,
): boolean {
  const minX = Math.min(a[0], b[0], c[0]);
  const maxX = Math.max(a[0], b[0], c[0]);
  const minZ = Math.min(a[2], b[2], c[2]);
  const maxZ = Math.max(a[2], b[2], c[2]);
  return TERRAIN_PROTECTED_REGIONS.some(region =>
    maxX >= region.minX && minX <= region.maxX &&
    maxZ >= region.minZ && minZ <= region.maxZ
  );
}

/** Offline only. Protected triangles are additionally pinned by the asset baker. */
export function reshapeTerrainPoint(point: TerrainPoint): TerrainPoint {
  if (!point.every(Number.isFinite)) throw new Error('Terrain outline requires finite positions.');
  const [x, planarZ] = terrainPlanarPoint(point);
  // The pinned, previously quantized source wanders up to 0.031 units at its edge.
  if (Math.max(Math.abs(x), Math.abs(planarZ)) > TERRAIN_HALF_SIZE + 0.05) {
    throw new Error('Terrain no longer matches the authored 60-unit heightfield.');
  }
  const radius = Math.hypot(x, planarZ);
  const angle = Math.atan2(planarZ, x);
  const inner = terrainInnerRadius(angle);
  if (radius <= inner + 1e-9) return point;
  // The forward tile is already below the sea. Preserve it rather than bending
  // its long, nearly collinear source faces for an invisible contour change.
  const strength = 1 - smoothstep(8, 18, planarZ);
  if (strength === 0) return point;

  // A smooth rounded-square reference avoids a derivative crease across each
  // tile diagonal, which can flip small triangles that straddle that diagonal.
  const referenceRadius = TERRAIN_HALF_SIZE /
    (Math.cos(angle) ** 8 + Math.sin(angle) ** 8) ** (1 / 8);
  const oldSpan = referenceRadius - inner;
  const newSpan = terrainOutlineRadius(angle) - inner;
  if (newSpan <= 0 || oldSpan <= 0) throw new Error('Terrain contour crosses its protected interior.');
  const t = (radius - inner) / oldSpan;
  const ratio = newSpan / oldSpan;
  // Positive derivative throughout; an eased inward offset can fold the fringe.
  const fullRadius = inner + newSpan * t / (ratio + (1 - ratio) * t);
  const shapedRadius = radius + (fullRadius - radius) * strength;
  const scale = shapedRadius / radius;
  const y = point[1];
  return [
    x * scale,
    y,
    (planarZ * scale + SIN_TILT * (y + 4)) / COS_TILT - 20,
  ];
}
