import * as THREE from 'three';

/** Screen-local coordinates: the separate, rectangular video/DOM display is at z = 0. */
export const CRT_HOUSING_APERTURE = {
  width: 0.55,
  height: 0.32,
  z: 0,
} as const;

/** Includes the cabinet, underside skids and the foremost tactile button faces. */
export const CRT_HOUSING_BOUNDS = {
  min: [-0.36, -0.274, -0.38],
  max: [0.36, 0.2, 0.046],
  center: [0, -0.037, -0.167],
  size: [0.72, 0.474, 0.426],
} as const;

export const CRT_HOUSING_PARTS = [
  'cabinet', 'rear', 'recess', 'metal', 'glassEdge', 'speakerRib', 'indicator',
] as const;

export type CRTHousingPart = typeof CRT_HOUSING_PARTS[number];

export const CRT_HOUSING_BUDGET = {
  drawCalls: 7,
  maxStoredVertices: 1800,
  maxSubmittedTriangles: 2700,
} as const;

const CONTROL_Y = -0.218;

export const CRT_SPEAKER_RIB_POSITIONS: ReadonlyArray<readonly [number, number, number]> =
  Array.from({ length: 7 }, (_, index) => [-0.118, CONTROL_Y + (index - 3) * 0.0058, 0.0315] as const);

type Point = readonly [number, number, number];
type Contour = readonly Point[];

const CORNER_SEGMENTS = 6;
const DETAIL_CORNER_SEGMENTS = 2;
const SMALL_BUTTON_SEGMENTS = 16;
const POWER_BUTTON_SEGMENTS = 24;
const INDICATOR_SEGMENTS = 12;
const SMALL_BUTTON_X = [0.138, 0.183] as const;
const POWER_BUTTON_X = 0.27;
const INDICATOR_X = 0.31;

function rectangle(
  width: number,
  height: number,
  radius: number,
  z: number,
  x = 0,
  y = 0,
  segments = CORNER_SEGMENTS,
  square = false,
): Contour {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centers = [
    [halfWidth - radius, halfHeight - radius],
    [-halfWidth + radius, halfHeight - radius],
    [-halfWidth + radius, -halfHeight + radius],
    [halfWidth - radius, -halfHeight + radius],
  ];
  const contour: Point[] = [];

  for (let corner = 0; corner < 4; corner += 1) {
    const quarterTurn = corner * Math.PI / 2;
    const cos = Math.cos(quarterTurn);
    const sin = Math.sin(quarterTurn);

    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      // A square opening needs an actual corner, not a rounded cut across the
      // DOM display. Sample its two straight edges without duplicate vertices.
      const u = square ? Math.min(1, 2 * (1 - t)) : Math.cos(t * Math.PI / 2);
      const v = square ? Math.min(1, 2 * t) : Math.sin(t * Math.PI / 2);
      contour.push([
        x + centers[corner][0] + radius * (u * cos - v * sin),
        y + centers[corner][1] + radius * (u * sin + v * cos),
        z,
      ]);
    }
  }

  return contour;
}

function circle(radius: number, z: number, x: number, segments: number): Contour {
  return Array.from({ length: segments }, (_, index) => {
    const angle = index * Math.PI * 2 / segments;
    return [x + Math.cos(angle) * radius, CONTROL_Y + Math.sin(angle) * radius, z] as const;
  });
}

class HousingBuilder {
  readonly positions: number[] = [];
  readonly indices: number[] = [];

  /** CCW contours run from the back outward, then inward over the front lip. */
  loft(contours: readonly Contour[]) {
    const start = this.positions.length / 3;
    const count = contours[0].length;
    for (const contour of contours) {
      for (const point of contour) this.positions.push(...point);
    }

    for (let band = 0; band < contours.length - 1; band += 1) {
      for (let index = 0; index < count; index += 1) {
        const next = (index + 1) % count;
        const a = start + band * count + index;
        const aNext = start + band * count + next;
        const b = a + count;
        const bNext = aNext + count;
        this.indices.push(a, aNext, bNext, a, bNext, b);
      }
    }
  }

  /** Separate cap vertices keep broad faces flat instead of smearing bevel normals. */
  cap(contour: Contour, rear = false) {
    const start = this.positions.length / 3;
    let x = 0;
    let y = 0;
    let z = 0;
    for (const point of contour) {
      this.positions.push(...point);
      x += point[0];
      y += point[1];
      z += point[2];
    }
    const center = this.positions.length / 3;
    this.positions.push(x / contour.length, y / contour.length, z / contour.length);

    for (let index = 0; index < contour.length; index += 1) {
      const a = start + index;
      const b = start + (index + 1) % contour.length;
      this.indices.push(center, rear ? b : a, rear ? a : b);
    }
  }
}

const cabinetFace = () => rectangle(0.698, 0.442, 0.031, 0.028, 0, -0.03);
const trimOutside = () => rectangle(0.63, 0.36, 0.018, 0.028);
const trimInside = () => rectangle(0.619, 0.349, 0.0125, 0.028);
const glassOutside = () => rectangle(0.555, 0.325, 0.0025, 0.002);
const speakerMouth = () => rectangle(0.344, 0.049, 0.005, 0.035, -0.118, CONTROL_Y);
const speakerBed = () => rectangle(0.336, 0.041, 0.003, 0.0295, -0.118, CONTROL_Y);

function addCabinet(builder: HousingBuilder) {
  builder.loft([
    rectangle(0.712, 0.452, 0.04, -0.079, 0, -0.03),
    rectangle(0.72, 0.46, 0.042, -0.04, 0, -0.03),
    rectangle(0.72, 0.46, 0.042, -0.004, 0, -0.03),
    rectangle(0.714, 0.454, 0.039, 0.014, 0, -0.03),
    cabinetFace(),
  ]);
  builder.loft([cabinetFace(), trimOutside()]);

  const fasciaFace = rectangle(0.637, 0.058, 0.006, 0.035, 0, CONTROL_Y);
  builder.loft([
    rectangle(0.645, 0.062, 0.008, 0.028, 0, CONTROL_Y),
    rectangle(0.641, 0.06, 0.007, 0.0335, 0, CONTROL_Y),
    fasciaFace,
  ]);
  // The fascia has a real recessed grille opening, not black stripes on a slab.
  builder.loft([fasciaFace, speakerMouth()]);

  const powerFace = circle(0.0104, 0.046, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS);
  builder.loft([
    circle(0.0113, 0.038, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    circle(0.0113, 0.043, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    powerFace,
  ]);
  builder.cap(powerFace);
}

function addRear(builder: HousingBuilder) {
  const back = rectangle(0.494, 0.298, 0.046, -0.38, 0, -0.02);
  builder.loft([
    back,
    rectangle(0.513, 0.317, 0.048, -0.371, 0, -0.022),
    rectangle(0.57, 0.363, 0.052, -0.281, 0, -0.026),
    rectangle(0.686, 0.428, 0.042, -0.108, 0, -0.03),
    rectangle(0.712, 0.452, 0.04, -0.083, 0, -0.03),
  ]);
  builder.cap(back, true);

  for (const x of [-0.245, 0.245]) {
    const heel = rectangle(0.07, 0.016, 0.004, -0.102, x, -0.254, DETAIL_CORNER_SEGMENTS);
    const nose = rectangle(0.078, 0.02, 0.005, -0.019, x, -0.26, DETAIL_CORNER_SEGMENTS);
    builder.loft([
      heel,
      rectangle(0.085, 0.026, 0.006, -0.091, x, -0.261, DETAIL_CORNER_SEGMENTS),
      rectangle(0.085, 0.026, 0.006, -0.029, x, -0.261, DETAIL_CORNER_SEGMENTS),
      nose,
    ]);
    builder.cap(heel, true);
    builder.cap(nose);
  }
}

function addRecesses(builder: HousingBuilder) {
  builder.loft([
    trimInside(),
    rectangle(0.612, 0.342, 0.011, 0.024),
    glassOutside(),
  ]);
  builder.loft([
    rectangle(0.712, 0.452, 0.04, -0.083, 0, -0.03),
    rectangle(0.712, 0.452, 0.04, -0.079, 0, -0.03),
  ]);
  builder.loft([speakerMouth(), speakerBed()]);
  builder.cap(speakerBed());

  for (const x of SMALL_BUTTON_X) {
    const gasket = circle(0.0118, 0.037, x, SMALL_BUTTON_SEGMENTS);
    builder.loft([circle(0.0118, 0.035, x, SMALL_BUTTON_SEGMENTS), gasket]);
    builder.cap(gasket);
  }
  const powerGasket = circle(0.0175, 0.037, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS);
  builder.loft([
    circle(0.0175, 0.035, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    powerGasket,
  ]);
  builder.cap(powerGasket);
}

function addMetal(builder: HousingBuilder) {
  builder.loft([
    trimOutside(),
    rectangle(0.628, 0.358, 0.017, 0.031),
    rectangle(0.622, 0.352, 0.014, 0.031),
    trimInside(),
  ]);

  for (const x of SMALL_BUTTON_X) {
    const face = circle(0.0085, 0.046, x, SMALL_BUTTON_SEGMENTS);
    builder.loft([
      circle(0.0098, 0.037, x, SMALL_BUTTON_SEGMENTS),
      circle(0.0098, 0.043, x, SMALL_BUTTON_SEGMENTS),
      face,
    ]);
    builder.cap(face);
  }

  builder.loft([
    circle(0.0155, 0.037, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    circle(0.0155, 0.0405, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    circle(0.0145, 0.042, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    circle(0.0119, 0.042, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
    circle(0.0119, 0.038, POWER_BUTTON_X, POWER_BUTTON_SEGMENTS),
  ]);
  builder.loft([
    circle(0.0042, 0.035, INDICATOR_X, INDICATOR_SEGMENTS),
    circle(0.0042, 0.037, INDICATOR_X, INDICATOR_SEGMENTS),
    circle(0.00265, 0.037, INDICATOR_X, INDICATOR_SEGMENTS),
    circle(0.00265, 0.035, INDICATOR_X, INDICATOR_SEGMENTS),
  ]);
}

function addGlassEdge(builder: HousingBuilder) {
  const { width, height, z } = CRT_HOUSING_APERTURE;
  builder.loft([
    glassOutside(),
    rectangle(width, height, 0.012, z, 0, 0, CORNER_SEGMENTS, true),
    rectangle(width, height, 0.012, z - 0.004, 0, 0, CORNER_SEGMENTS, true),
  ]);
}

function addSpeakerRib(builder: HousingBuilder) {
  const face = rectangle(0.333, 0.0016, 0.00065, 0.0021, 0, 0, DETAIL_CORNER_SEGMENTS);
  builder.loft([
    rectangle(0.334, 0.0026, 0.0011, -0.0022, 0, 0, DETAIL_CORNER_SEGMENTS),
    rectangle(0.334, 0.0026, 0.0011, 0.0009, 0, 0, DETAIL_CORNER_SEGMENTS),
    face,
  ]);
  builder.cap(face);
}

function addIndicator(builder: HousingBuilder) {
  const face = circle(0.00185, 0.039, INDICATOR_X, INDICATOR_SEGMENTS);
  builder.loft([
    circle(0.0024, 0.035, INDICATOR_X, INDICATOR_SEGMENTS),
    circle(0.0024, 0.0375, INDICATOR_X, INDICATOR_SEGMENTS),
    face,
  ]);
  builder.cap(face);
}

const PART_BUILDERS: Record<CRTHousingPart, (builder: HousingBuilder) => void> = {
  cabinet: addCabinet,
  rear: addRear,
  recess: addRecesses,
  metal: addMetal,
  glassEdge: addGlassEdge,
  speakerRib: addSpeakerRib,
  indicator: addIndicator,
};

/** Area weighting tilts opposite roof ends differently across each quad diagonal. */
function refineRoofNormals(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const indices = geometry.getIndex()!;
  const contourSize = 4 * (CORNER_SEGMENTS + 1);
  const isRoof = (vertex: number) => vertex < 5 * contourSize && vertex % contourSize < contourSize / 2;
  const sums = new Float64Array(5 * contourSize * 3);
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (let triangle = 0; triangle < indices.count; triangle += 3) {
    const vertices = [0, 1, 2].map(corner => indices.getX(triangle + corner));
    if (!vertices.some(isRoof)) continue;
    points.forEach((point, corner) => point.fromBufferAttribute(position, vertices[corner]));
    face.subVectors(points[1], points[0]).cross(second.subVectors(points[2], points[0])).normalize();
    vertices.forEach((vertex, corner) => {
      if (!isRoof(vertex)) return;
      first.subVectors(points[(corner + 1) % 3], points[corner]).normalize();
      second.subVectors(points[(corner + 2) % 3], points[corner]).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(first.dot(second), -1, 1));
      sums[vertex * 3] += face.x * angle;
      sums[vertex * 3 + 1] += face.y * angle;
      sums[vertex * 3 + 2] += face.z * angle;
    });
  }
  for (let vertex = 0; vertex < 5 * contourSize; vertex++) {
    if (!isRoof(vertex)) continue;
    first.fromArray(sums, vertex * 3).normalize();
    normal.setXYZ(vertex, first.x, first.y, first.z);
  }
}

/**
 * Indexed, material-batched surfaces. A loft band costs 2N triangles, a cap N:
 * N = 28 for cabinet contours, 12 for ribs/skids, 16/24/12 for the controls.
 * The seven owned buffers store 1,738 vertices; seven rib instances bring the
 * submitted total to 2,616 triangles in seven draws (no shadow or extra passes).
 *
 * Register as an R3F geometry element for declarative disposal; standalone
 * callers, including tests, own disposal. Nothing comes from the GLTF cache.
 */
export class CrtHousingGeometry extends THREE.BufferGeometry {
  constructor(part: CRTHousingPart) {
    super();
    const builder = new HousingBuilder();
    PART_BUILDERS[part](builder);
    this.name = `crt-housing-${part}`;
    this.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
    this.setIndex(builder.indices);
    this.computeVertexNormals();
    if (part === 'cabinet' || part === 'rear') refineRoofNormals(this);
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }
}
