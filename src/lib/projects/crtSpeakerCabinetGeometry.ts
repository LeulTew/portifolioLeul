import * as THREE from 'three';

export const CRT_SPEAKER_CABINET_PARTS = ['shell', 'grille', 'trim'] as const;
export type CrtSpeakerCabinetPart = typeof CRT_SPEAKER_CABINET_PARTS[number];

export const CRT_SPEAKER_CABINET_TOP_Y = -0.254;
export const CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y = -3.05;
export const CRT_SPEAKER_CABINET_FOOTPRINT = {
  width: 0.712, back: -0.32, front: 0.019, radius: 0.014, localY: -0.49,
} as const;
export const CRT_SPEAKER_GRILLE = {
  width: 0.634, top: -0.282, bottom: -0.392, radius: 0.004, z: 0.01,
} as const;
export const CRT_SPEAKER_CABINET_BUDGET = {
  drawCalls: 3,
  maxStoredVertices: 650,
  maxSubmittedTriangles: 280,
} as const;

type Point = readonly [number, number, number];
type Contour = readonly Point[];
const graphite = new THREE.Color('#45443f');
const rearGraphite = new THREE.Color('#2b2c28');
const recess = new THREE.Color('#111613');
const white = new THREE.Color('#ffffff');

function rectangle(width: number, top: number, bottom: number, radius: number, z: number): Contour {
  const centers = [
    [width / 2 - radius, top - radius],
    [-width / 2 + radius, top - radius],
    [-width / 2 + radius, bottom + radius],
    [width / 2 - radius, bottom + radius],
  ];
  return centers.flatMap(([x, y], corner) =>
    [0, 1, 2].map(step => {
      const angle = (corner + step / 2) * Math.PI / 2;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z] as const;
    }),
  );
}

function footprint(width: number, back: number, front: number, radius: number, y: number): Contour {
  return rectangle(width, -back, -front, radius, 0).map(([x, z]) => [x, y, -z] as const);
}

class CabinetBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly uvs: number[] = [];
  readonly indices: number[] = [];

  face(points: Contour, color: THREE.Color) {
    const start = this.positions.length / 3;
    for (const point of points) {
      this.positions.push(...point);
      this.colors.push(color.r, color.g, color.b);
      this.uvs.push(
        point[0] / CRT_SPEAKER_GRILLE.width + 0.5,
        (point[1] - CRT_SPEAKER_GRILLE.bottom) / (CRT_SPEAKER_GRILLE.top - CRT_SPEAKER_GRILLE.bottom),
      );
    }
    for (let index = 1; index < points.length - 1; index++) {
      this.indices.push(start, start + index, start + index + 1);
    }
  }

  loft(contours: readonly Contour[], color: THREE.Color) {
    for (let band = 0; band < contours.length - 1; band++) {
      const a = contours[band];
      const b = contours[band + 1];
      for (let index = 0; index < a.length; index++) {
        const next = (index + 1) % a.length;
        this.face([a[index], a[next], b[next], b[index]], color);
      }
    }
  }

  cap(contour: Contour, color: THREE.Color, reverse = false, crown = 0) {
    const center: [number, number, number] = [0, 0, crown];
    for (const point of contour) {
      for (const axis of [0, 1, 2] as const) center[axis] += point[axis] / contour.length;
    }
    for (let index = 0; index < contour.length; index++) {
      const next = (index + 1) % contour.length;
      this.face([center, contour[reverse ? next : index], contour[reverse ? index : next]], color);
    }
  }
}

const cabinetFace = () => rectangle(0.69, CRT_SPEAKER_CABINET_TOP_Y, -0.488, 0.026, 0.024);
const grilleMouth = () => rectangle(0.644, -0.278, -0.396, 0.008, 0.024);
const grilleBed = () => {
  const { width, top, bottom, radius, z } = CRT_SPEAKER_GRILLE;
  return rectangle(width, top, bottom, radius, z);
};

function addShell(builder: CabinetBuilder, screenWorld: THREE.Matrix4) {
  const back = rectangle(0.65, -0.265, -0.482, 0.015, -0.31);
  builder.cap(back, rearGraphite, true);
  builder.loft([
    back,
    rectangle(0.7, -0.258, -0.488, 0.018, -0.29),
    rectangle(0.704, CRT_SPEAKER_CABINET_TOP_Y, -0.494, 0.028, -0.052),
    cabinetFace(),
  ], graphite);
  builder.loft([cabinetFace(), grilleMouth()], graphite);
  builder.loft([grilleMouth(), grilleBed()], recess);

  const { width, back: rear, front, radius, localY } = CRT_SPEAKER_CABINET_FOOTPRINT;
  const outline = footprint(width, rear, front, radius, localY);
  const inverse = screenWorld.clone().invert();
  // Preserve each contact's world XZ, just as the former supports did, while
  // closing the entire underside below the sloping terrain rather than on legs.
  const level = (worldY: number): Contour => outline.map(point => {
    const vertex = new THREE.Vector3(...point).applyMatrix4(screenWorld);
    vertex.y = worldY;
    return vertex.applyMatrix4(inverse).toArray();
  });
  const bottom = level(CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y);
  const top = footprint(0.694, -0.302, 0.012, 0.013, -0.481);
  builder.cap(bottom, recess, true);
  builder.loft([bottom, level(CRT_SPEAKER_CABINET_BOTTOM_WORLD_Y + 0.045), top], rearGraphite);
  builder.cap(top, recess);
}

function addTrim(builder: CabinetBuilder) {
  const back = rectangle(0.627, -0.2685, -0.2725, 0.0018, 0.024);
  const front = rectangle(0.623, -0.269, -0.272, 0.0013, 0.029);
  builder.loft([back, front], white);
  builder.cap(back, white, true);
  builder.cap(front, white);
}

/** Three static, material-batched surfaces mounted in the unchanged screen frame. */
export class CrtSpeakerCabinetGeometry extends THREE.BufferGeometry {
  constructor(part: CrtSpeakerCabinetPart, screenWorld: THREE.Matrix4) {
    super();
    const builder = new CabinetBuilder();
    switch (part) {
      case 'shell': addShell(builder, screenWorld); break;
      case 'grille': builder.cap(grilleBed(), white, false, 0.002); break;
      case 'trim': addTrim(builder); break;
    }
    this.name = `crt-speaker-cabinet-${part}`;
    this.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3));
    this.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3));
    this.setAttribute('uv', new THREE.Float32BufferAttribute(builder.uvs, 2));
    this.setIndex(builder.indices);
    this.computeVertexNormals();
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }
}
