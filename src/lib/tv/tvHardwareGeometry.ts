import * as THREE from 'three';
import {
  TV_CONTROLS, TV_CONTROL_IDS, TV_HARDWARE_MOTION, type TVControlId,
} from './tvHardware';

type Point = readonly [number, number, number];
type Contour = readonly Point[];
type WellContour = 'outer' | 'lip' | 'mouth';

export const TV_HARDWARE_BUDGET = {
  drawCalls: 1,
  maxSubmittedTriangles: 650,
  maxCompleteTVTriangles: 3500,
  maxCompleteTVDrawCalls: 12,
} as const;

export const TV_CONTROL_WELL = { rimZ: 0.039, floorZ: 0.016 } as const;

export interface TVCapRange {
  readonly start: number;
  readonly count: number;
  readonly indexStart: number;
  readonly indexCount: number;
}

function roundedRectangle(
  id: TVControlId, width: number, height: number, radius: number, z: number,
): Contour {
  const [x, y] = TV_CONTROLS[id].center;
  const contour: Point[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2;
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
    const cy = (corner < 2 ? 1 : -1) * (height / 2 - radius);
    for (let step = 0; step <= 2; step++) {
      const a = angle + step * Math.PI / 4;
      contour.push([x + cx + Math.cos(a) * radius, y + cy + Math.sin(a) * radius, z]);
    }
  }
  return contour;
}

/** Shared outlines keep the actual fascia cut-outs registered with the caps. */
export function getTVControlWellContour(id: TVControlId, z: number, contour: WellContour): Contour {
  const control = TV_CONTROLS[id];
  const width = contour === 'outer' ? 0.008 : contour === 'lip' ? 0.006 : 0.003;
  const height = contour === 'outer' ? 0.005 : contour === 'lip' ? 0.0035 : 0.002;
  return roundedRectangle(id, control.width + width, control.height + height, control.radius + 0.001, z);
}

class HardwareBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  private append(contour: Contour, color: THREE.Color): void {
    for (const point of contour) {
      this.positions.push(...point);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  loft(contours: readonly Contour[], color: THREE.Color): void {
    const start = this.positions.length / 3;
    const count = contours[0].length;
    for (const contour of contours) this.append(contour, color);
    for (let band = 0; band < contours.length - 1; band++) {
      for (let index = 0; index < count; index++) {
        const next = (index + 1) % count;
        const a = start + band * count + index;
        const b = start + band * count + next;
        this.indices.push(a, b, b + count, a, b + count, a + count);
      }
    }
  }

  face(contour: Contour, holes: readonly Contour[], color: THREE.Color, rear = false): void {
    const start = this.positions.length / 3;
    const points = contour.map(([x, y]) => new THREE.Vector2(x, y));
    const cutouts = holes.map(hole => hole.map(([x, y]) => new THREE.Vector2(x, y)));
    const faces = THREE.ShapeUtils.triangulateShape(points, cutouts);
    this.append(contour, color);
    for (const hole of holes) this.append(hole, color);
    for (const [a, b, c] of faces) {
      this.indices.push(start + a, start + (rear ? c : b), start + (rear ? b : c));
    }
  }
}

function engraving(id: TVControlId, z: number): Contour[] {
  const [x, y] = TV_CONTROLS[id].center;
  if (id !== 'power') {
    const direction = id === 'previous' ? 1 : -1;
    const outline = [
      [0.0035, 0.007], [-0.002, 0], [0.0035, -0.007],
      [0.0015, -0.0085], [-0.006, 0], [0.0015, 0.0085],
    ];
    if (direction < 0) outline.reverse();
    return [outline.map(([dx, dy]) => [x + dx * direction, y + dy, z] as const)];
  }
  const ring: Point[] = [];
  for (const [radius, backwards] of [[0.009, false], [0.0066, true]] as const) {
    for (let index = 0; index <= 16; index++) {
      const t = (backwards ? 16 - index : index) / 16;
      const angle = (130 + 280 * t) * Math.PI / 180;
      ring.push([x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z]);
    }
  }
  return [
    ring,
    [[x - 0.0012, y + 0.003, z], [x + 0.0012, y + 0.003, z],
      [x + 0.0012, y + 0.011, z], [x - 0.0012, y + 0.011, z]],
  ];
}

function addCap(builder: HardwareBuilder, id: TVControlId): void {
  const { width, height, radius } = TV_CONTROLS[id];
  const power = id === 'power';
  const sideColor = new THREE.Color(power ? '#303b33' : '#596056');
  const edgeColor = new THREE.Color(power ? '#7c8878' : '#b2b5a5');
  const faceColor = new THREE.Color(power ? '#3c493e' : '#92998a');
  const inkColor = new THREE.Color(power ? '#c1cdb6' : '#17221a');
  const back = roundedRectangle(id, width - 0.004, height - 0.004, radius - 0.002, 0.028);
  const shoulder = roundedRectangle(id, width, height, radius, 0.031);
  const edge = roundedRectangle(id, width, height, radius, 0.0435);
  const face = roundedRectangle(id, width - 0.004, height - 0.004, radius - 0.002, 0.046);
  builder.loft([back, shoulder, edge], sideColor);
  builder.loft([edge, face], edgeColor);
  builder.face(back, [], sideColor, true);
  const marks = engraving(id, 0.046);
  builder.face(face, marks, faceColor);
  for (const mark of marks) {
    // An actual shallow pocket with a painted floor, not a floating text decal.
    const floor = mark.map(([x, y, z]) => [x, y, z - 0.00045] as const);
    const clockwise = THREE.ShapeUtils.isClockWise(mark.map(([x, y]) => new THREE.Vector2(x, y)));
    builder.loft(clockwise ? [floor, mark] : [mark, floor], sideColor);
    builder.face(floor, [], inkColor);
  }
}

/** Three independently translating cap ranges, including their engraved faces, in one owned draw. */
export class TvHardwareGeometry extends THREE.BufferGeometry {
  readonly capRanges: Readonly<Record<TVControlId, TVCapRange>>;
  private readonly restPositions: Float32Array;
  private readonly depths: Record<TVControlId, number> = { previous: 0, next: 0, power: 0 };

  constructor() {
    super();
    const builder = new HardwareBuilder();
    const ranges = {} as Record<TVControlId, TVCapRange>;
    for (const id of TV_CONTROL_IDS) {
      const start = builder.positions.length / 3;
      const indexStart = builder.indices.length;
      addCap(builder, id);
      ranges[id] = {
        start, count: builder.positions.length / 3 - start,
        indexStart, indexCount: builder.indices.length - indexStart,
      };
    }
    this.capRanges = ranges;
    this.name = 'crt-independent-mechanical-caps';
    const positions = new THREE.Float32BufferAttribute(builder.positions, 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    this.restPositions = new Float32Array(positions.array);
    this.setAttribute('position', positions);
    this.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
    this.setIndex(builder.indices);
    this.computeVertexNormals();
    this.computeBoundingBox();
    // One conservative bound covers the complete travel without per-frame recomputation.
    this.boundingBox!.min.z -= TV_HARDWARE_MOTION.pressTravel + TV_HARDWARE_MOTION.powerLatchTravel + 1e-7;
    this.boundingSphere = this.boundingBox!.getBoundingSphere(new THREE.Sphere());
  }

  setDepth(id: TVControlId, depth: number): boolean {
    const maximum = TV_HARDWARE_MOTION.pressTravel + TV_HARDWARE_MOTION.powerLatchTravel;
    const next = Number.isFinite(depth) ? Math.max(0, Math.min(maximum, depth)) : 0;
    if (this.depths[id] === next) return false;
    this.depths[id] = next;
    const position = this.getAttribute('position') as THREE.BufferAttribute;
    const { start, count } = this.capRanges[id];
    for (let vertex = start; vertex < start + count; vertex++) {
      position.setZ(vertex, this.restPositions[vertex * 3 + 2] - next);
    }
    position.needsUpdate = true;
    return true;
  }

  restore(powered = false): void {
    for (const id of TV_CONTROL_IDS) {
      this.setDepth(id, id === 'power' && powered ? TV_HARDWARE_MOTION.powerLatchTravel : 0);
    }
  }
}
