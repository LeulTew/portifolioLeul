import * as THREE from 'three';

export const CRT_SUPPORT_TOP_Y = -0.274;
export const CRT_SUPPORT_TOP_HALF_WIDTH = 0.046;
export const CRT_SUPPORT_BASE_HALF_WIDTH = 0.05;
export const CRT_SUPPORT_DEPTH = [-0.11, -0.01] as const;

/** Measured on both terrain meshes. The left base avoids an open triangle seam. */
export const CRT_SUPPORT_STATIONS = [
  { topX: -0.245, baseX: -0.275, bottomWorldY: -2.8 },
  { topX: 0.245, baseX: 0.245, bottomWorldY: -2.12 },
] as const;

export class CrtSupportGeometry extends THREE.BufferGeometry {
  constructor(screenWorld: THREE.Matrix4) {
    super();
    const inverse = screenWorld.clone().invert();
    const positions: number[] = [];
    const faces = [
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ];
    for (const support of CRT_SUPPORT_STATIONS) {
      const corners: THREE.Vector3[] = [];
      for (const bottom of [false, true]) {
        const x = bottom ? support.baseX : support.topX;
        const half = bottom ? CRT_SUPPORT_BASE_HALF_WIDTH : CRT_SUPPORT_TOP_HALF_WIDTH;
        for (const [offsetX, z] of [[-half, CRT_SUPPORT_DEPTH[0]], [half, CRT_SUPPORT_DEPTH[0]],
          [half, CRT_SUPPORT_DEPTH[1]], [-half, CRT_SUPPORT_DEPTH[1]]]) {
          const corner = new THREE.Vector3(x + offsetX, CRT_SUPPORT_TOP_Y, z);
          if (bottom) {
            corner.applyMatrix4(screenWorld);
            corner.y = support.bottomWorldY;
            corner.applyMatrix4(inverse);
          }
          corners.push(corner);
        }
      }
      for (const vertex of faces) positions.push(...corners[vertex].toArray());
    }
    this.name = 'crt-ground-supports';
    this.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.computeVertexNormals();
    this.computeBoundingBox();
    this.computeBoundingSphere();
  }
}
