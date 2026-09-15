import type { SkillScene } from './skillsData';

type Point = readonly [number, number];
type Cubic = readonly [Point, Point, Point, Point];
export type MaterialQuality = 'full' | 'economy';

interface MaterialPose {
  radii: Point;
  exponent: number;
  inset: number;
  warp: number;
  lobes: number;
  matrix: readonly [number, number, number, number];
  centerY: number;
  depth: number;
  panelOpacity: number;
  panelInset?: number;
  surfaceOpacity: number;
  outline?: readonly Point[];
  innerOutline?: readonly Point[];
}

export const MATERIAL_POSES: Record<SkillScene, MaterialPose> = {
  languages: {
    radii: [156, 120], exponent: 6, inset: 0, warp: 0, lobes: 0,
    matrix: [0.96, 0.44, -0.8, 0.46], centerY: 286, depth: 38,
    panelOpacity: 1, panelInset: 0.67, surfaceOpacity: 1,
  },
  interfaces: {
    radii: [165, 132], exponent: 8, inset: 0.83, warp: 0, lobes: 0,
    matrix: [0.96, 0.25, -0.22, 0.94], centerY: 282, depth: 22, panelOpacity: 1, surfaceOpacity: 1,
  },
  intelligence: {
    radii: [168, 168], exponent: 2, inset: 0.76, warp: 0, lobes: 0,
    matrix: [1, 0, 0, 1], centerY: 280, depth: 38, panelOpacity: 0, surfaceOpacity: 0,
  },
  data: {
    radii: [170, 142], exponent: 2.2, inset: 0, warp: 0, lobes: 0,
    matrix: [0.97, 0.2, -0.36, 0.5], centerY: 210, depth: 128,
    panelOpacity: 1, panelInset: 0.72, surfaceOpacity: 1,
  },
  design: {
    radii: [152, 144], exponent: 2.5, inset: 0, warp: 0, lobes: 0,
    matrix: [0.98, -0.09, 0.17, 0.9], centerY: 260, depth: 22, panelOpacity: 0, surfaceOpacity: 1,
    outline: [[0, -156], [90, -120], [100, -60], [65, 50], [0, 160], [-65, 50], [-100, -60], [-90, -120]],
    innerOutline: [[-7, -78], [7, -78], [7, -64], [2, -54], [2, 106], [0, 134], [-2, 106], [-2, -54], [-7, -64]],
  },
  delivery: {
    radii: [174, 156], exponent: 2.2, inset: 0.7, warp: 0, lobes: 0.13,
    matrix: [0.97, 0.2, -0.12, 0.87], centerY: 278, depth: 42, panelOpacity: 0, surfaceOpacity: 0,
  },
};

const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const line = (from: Point, to: Point): Cubic => [from, mix(from, to, 1 / 3), mix(from, to, 2 / 3), to];

export const LEARNING_NODES: readonly Point[] = [
  [-145, -67], [-137, 0], [-129, 68],
  [-8, -105], [0, -36], [8, 34], [16, 105],
  [130, -52], [138, 18], [146, 86],
];
export const LEARNING_LINKS = [
  { from: 0, to: 3, weight: 0.28 },
  { from: 1, to: 4, weight: 1 },
  { from: 2, to: 5, weight: 0.3 },
  { from: 2, to: 6, weight: 0.22 },
  { from: 3, to: 7, weight: 0.28 },
  { from: 4, to: 8, weight: 1 },
  { from: 5, to: 9, weight: 0.28 },
  { from: 6, to: 9, weight: 0.4 },
] as const;

function neuralConnection(from: Point, to: Point): Cubic {
  const reach = (to[0] - from[0]) * 0.42;
  return [from, [from[0] + reach, from[1]], [to[0] - reach, to[1]], to];
}

export const DELIVERY_NODES: readonly Point[] = [[-93, -53], [95, -53], [0, 92]];

const ENGRAVINGS: Record<SkillScene, readonly Cubic[]> = {
  languages: [
    [[-34, -49], [-79, -49], [-33, -6], [-74, 0]],
    [[-74, 0], [-33, 6], [-79, 49], [-34, 49]],
    [[34, -49], [79, -49], [33, -6], [74, 0]],
    [[74, 0], [33, 6], [79, 49], [34, 49]],
    line([15, -44], [-15, 44]),
  ],
  interfaces: [
    line([-113, -70], [113, -70]),
    line([-63, -70], [-63, 90]),
    line([-36, -36], [89, -36]),
    line([-36, -16], [53, -16]),
    line([-36, 6], [94, 6]),
    line([-33, 51], [9, 51]),
    line([-33, 69], [9, 69]),
    line([49, 60], [96, 60]),
  ],
  intelligence: LEARNING_LINKS.map(({ from, to }) => neuralConnection(LEARNING_NODES[from], LEARNING_NODES[to])),
  data: [
    line([-108, -52], [108, -52]),
    line([-108, -22], [108, -22]),
    line([-108, 10], [108, 10]),
    line([-108, 42], [108, 42]),
    line([-108, -52], [-108, 42]),
    line([-40, -52], [-40, 42]),
    line([35, -52], [35, 42]),
    line([108, -52], [108, 42]),
  ],
  design: [],
  delivery: [
    line(DELIVERY_NODES[0], DELIVERY_NODES[1]),
    line(DELIVERY_NODES[1], DELIVERY_NODES[2]),
    line(DELIVERY_NODES[2], DELIVERY_NODES[0]),
    line([-27, 4], [-8, 23]),
    line([-8, 23], [34, -24]),
  ],
};

export function projectMaterialPoint(scene: SkillScene, [u, v]: Point): Point {
  const { matrix: [a, b, c, d], centerY } = MATERIAL_POSES[scene];
  return [360 + a * u + c * v, centerY + b * u + d * v];
}

export function materialMatrix(scene: SkillScene): string {
  const pose = MATERIAL_POSES[scene];
  return `matrix(${pose.matrix.join(' ')} 360 ${pose.centerY})`;
}

const pointText = ([x, y]: Point) => `${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`;

function sampleOutline(outline: readonly Point[], count: number): Point[] {
  const lengths = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: count }, (_, index) => {
    let distance = index / count * perimeter;
    let edge = 0;
    while (edge < lengths.length - 1 && distance > lengths[edge]) distance -= lengths[edge++];
    return mix(outline[edge], outline[(edge + 1) % outline.length], distance / lengths[edge]);
  });
}

/** Every pose has the same cubic topology, so the actual surface can morph. */
function closedContour(points: readonly Point[], sharpness = 0) {
  const count = points.length;
  let path = `M${pointText(points[0])}`;
  const coordinates = [points[0][0], points[0][1]];
  for (let index = 0; index < count; index++) {
    const previous = points[(index + count - 1) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const following = points[(index + 2) % count];
    const first: Point = [
      current[0] + (next[0] - previous[0]) / 6,
      current[1] + (next[1] - previous[1]) / 6,
    ];
    const second: Point = [
      next[0] - (following[0] - current[0]) / 6,
      next[1] - (following[1] - current[1]) / 6,
    ];
    const controlOne = mix(first, mix(current, next, 1 / 3), sharpness);
    const controlTwo = mix(second, mix(current, next, 2 / 3), sharpness);
    path += `C${pointText(controlOne)} ${pointText(controlTwo)} ${pointText(next)}`;
    coordinates.push(...controlOne, ...controlTwo, ...next);
  }
  return { path: `${path}Z`, coordinates };
}

function buildGeometry(scene: SkillScene, segments: number) {
  const pose = MATERIAL_POSES[scene];
  const local = pose.outline ? sampleOutline(pose.outline, segments) : Array.from({ length: segments }, (_, index): Point => {
    const angle = index / segments * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const radius = 1 + pose.lobes * Math.cos(angle * 3);
    const u = Math.sign(cos) * Math.abs(cos) ** (2 / pose.exponent) * pose.radii[0] * radius;
    const v = Math.sign(sin) * Math.abs(sin) ** (2 / pose.exponent) * pose.radii[1] * radius;
    return [
      u + Math.sin(angle * 2) * pose.radii[0] * pose.warp,
      v + Math.cos(angle * 3) * pose.radii[1] * pose.warp * 0.45,
    ];
  });
  const outer = local.map(point => projectMaterialPoint(scene, point));
  const inner = pose.innerOutline
    ? sampleOutline(pose.innerOutline, segments).map(point => projectMaterialPoint(scene, point))
    : local.map(([u, v]) => projectMaterialPoint(scene, [u * pose.inset, v * pose.inset]));
  const panelInset = pose.panelInset;
  const panelPoints = panelInset === undefined ? inner
    : local.map(([u, v]) => projectMaterialPoint(scene, [u * panelInset, v * panelInset]));
  const engravings = ENGRAVINGS[scene];
  const sharpness = pose.outline ? 1 : 0;
  const signals = Array.from({ length: 8 }, (_, index) => {
    const stroke = engravings[index];
    const points = (stroke ?? [[0, 0], [0, 0], [0, 0], [0, 0]]).map(point =>
      projectMaterialPoint(scene, point));
    return {
      d: `M${pointText(points[0])}C${points.slice(1).map(pointText).join(' ')}`,
      points,
      opacity: stroke ? (scene === 'intelligence' ? LEARNING_LINKS[index].weight : 1) : 0,
    };
  });
  const outerContour = closedContour(outer, sharpness);
  const innerContour = closedContour(inner, sharpness);
  const holeContour = closedContour([...inner].reverse(), sharpness);
  const panelContour = closedContour(panelPoints, sharpness);
  return {
    shell: `${outerContour.path}${holeContour.path}`,
    panel: panelContour.path,
    outer,
    inner,
    panelPoints,
    outerContour: outerContour.coordinates,
    innerContour: innerContour.coordinates,
    panelContour: panelContour.coordinates,
    signals,
    depth: pose.depth,
    panelOpacity: pose.panelOpacity,
    surfaceOpacity: pose.surfaceOpacity,
    sharpness,
  };
}

const geometrySet = (segments: number) => ({
  languages: buildGeometry('languages', segments),
  interfaces: buildGeometry('interfaces', segments),
  intelligence: buildGeometry('intelligence', segments),
  data: buildGeometry('data', segments),
  design: buildGeometry('design', segments),
  delivery: buildGeometry('delivery', segments),
});
const GEOMETRY = { full: geometrySet(12), economy: geometrySet(8) };

export const getMaterialGeometry = (scene: SkillScene, quality: MaterialQuality = 'full') => GEOMETRY[quality][scene];
