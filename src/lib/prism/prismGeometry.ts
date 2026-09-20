import * as THREE from 'three';

export const PRISM_SEGMENTS = 80;
export const PRISM_KEYS = 257;
export const PRISM_FINAL_SCALE = 1.3;
export const PRISM_LIFT = 6;
const STRIDE = (PRISM_SEGMENTS + 1) * 3;
const SPAN = 5.6;

export function prismEase(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (6 * t - 15) + 10);
}

/** Enlarged subarcs of an embedded OPEN curve; never a straight-to-knot blend. */
export function samplePrismStrand(progress: number, out: Float32Array | Float64Array): void {
  if (!Number.isFinite(progress) || out.length !== STRIDE) throw new RangeError('Invalid prism strand sample.');
  const p = Math.max(0, Math.min(1, progress));
  if (p < 1e-8) {
    for (let i = 0; i <= PRISM_SEGMENTS; i++) {
      out[i * 3] = out[i * 3 + 2] = 0;
      out[i * 3 + 1] = 12 * (i / PRISM_SEGMENTS - 0.5);
    }
    return;
  }
  const span = SPAN * p;
  const middle = (2 + Math.cos(3 * span / 2)) * Math.cos(span);
  const scale = PRISM_FINAL_SCALE + 12 * (1 - p) / (span * Math.sqrt(45));
  for (let i = 0; i <= PRISM_SEGMENTS; i++) {
    const t = span * (i / PRISM_SEGMENTS - 0.5);
    const x = (2 + Math.cos(3 * t)) * Math.cos(2 * t) - middle;
    const y = (2 + Math.cos(3 * t)) * Math.sin(2 * t);
    const z = Math.sin(3 * t);
    // Bend into the unoccupied side of the island, away from the character.
    out[i * 3] = -scale * x;
    out[i * 3 + 1] = scale * (2 * y + z) / Math.sqrt(5);
    out[i * 3 + 2] = scale * (-y + 2 * z) / Math.sqrt(5);
  }
}

export function prismPose(progress: number, out: { lift: number; bend: number }): void {
  out.lift = PRISM_LIFT * prismEase(progress / 0.28);
  out.bend = prismEase((progress - 0.28) / 0.72);
}

/** Fixed owned buffers: 644 body triangles and one sparse outer-line draw. */
export class PrismStrandGeometry {
  readonly body = new THREE.BufferGeometry();
  readonly cage = new THREE.BufferGeometry();
  readonly centerline = new Float32Array(STRIDE);
  readonly normals = new Float32Array(STRIDE);
  readonly positions = new Float32Array(((PRISM_SEGMENTS + 1) * 8 + 8) * 3);
  readonly surfaceNormals = new Float32Array(this.positions.length);
  readonly cagePositions = new Float32Array((PRISM_SEGMENTS + 1) * 4 * 3);
  private keys = new Float32Array(PRISM_KEYS * STRIDE);
  private normalKeys = new Float32Array(this.keys.length);
  private tangent = new THREE.Vector3();
  private previousTangent = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private binormal = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private firstTangent = new THREE.Vector3(0, 1, 0);
  private firstNormal = new THREE.Vector3(1, 0, 0);
  private positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
  private normalAttribute = new THREE.BufferAttribute(this.surfaceNormals, 3).setUsage(THREE.DynamicDrawUsage);
  private cageAttribute = new THREE.BufferAttribute(this.cagePositions, 3).setUsage(THREE.DynamicDrawUsage);

  constructor() {
    for (let key = 0; key < PRISM_KEYS; key++) {
      samplePrismStrand(key / (PRISM_KEYS - 1), this.centerline);
      this.keys.set(this.centerline, key * STRIDE);
      this.direction(0, this.tangent);
      this.firstNormal.applyQuaternion(this.rotation.setFromUnitVectors(this.firstTangent, this.tangent));
      this.firstNormal.addScaledVector(this.tangent, -this.firstNormal.dot(this.tangent)).normalize();
      this.firstTangent.copy(this.tangent);
      this.normal.copy(this.firstNormal);
      for (let i = 0; i <= PRISM_SEGMENTS; i++) {
        this.direction(i, this.tangent);
        if (i) this.normal.applyQuaternion(this.rotation.setFromUnitVectors(this.previousTangent, this.tangent));
        this.normal.addScaledVector(this.tangent, -this.normal.dot(this.tangent)).normalize();
        this.normalKeys.set([this.normal.x, this.normal.y, this.normal.z], key * STRIDE + i * 3);
        this.previousTangent.copy(this.tangent);
      }
    }
    const triangles: number[] = [];
    const lines: number[] = [];
    for (let i = 0; i < PRISM_SEGMENTS; i++) {
      for (let face = 0; face < 4; face++) {
        const a = i * 8 + face * 2, b = a + 1, c = a + 8, d = b + 8;
        triangles.push(a, b, c, b, d, c);
        lines.push(i * 4 + face, (i + 1) * 4 + face);
      }
    }
    const cap = (PRISM_SEGMENTS + 1) * 8;
    triangles.push(cap, cap + 2, cap + 1, cap, cap + 3, cap + 2,
      cap + 4, cap + 5, cap + 6, cap + 4, cap + 6, cap + 7);
    for (const ring of [0, PRISM_SEGMENTS]) {
      for (let side = 0; side < 4; side++) lines.push(ring * 4 + side, ring * 4 + (side + 1) % 4);
    }
    this.body.setAttribute('position', this.positionAttribute);
    this.body.setAttribute('normal', this.normalAttribute);
    this.body.setIndex(triangles);
    this.cage.setAttribute('position', this.cageAttribute);
    this.cage.setIndex(lines);
    this.body.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 16);
    this.body.boundingBox = new THREE.Box3();
    this.cage.boundingSphere = this.body.boundingSphere.clone();
    this.update(0);
  }

  private direction(i: number, out: THREE.Vector3): void {
    const a = Math.max(0, i - 1) * 3, b = Math.min(PRISM_SEGMENTS, i + 1) * 3;
    out.set(this.centerline[b] - this.centerline[a],
      this.centerline[b + 1] - this.centerline[a + 1],
      this.centerline[b + 2] - this.centerline[a + 2]).normalize();
  }

  private vertex(buffer: Float32Array, index: number, station: number, nx: number, nz: number, radius: number): void {
    const point = station * 3, vertex = index * 3;
    buffer[vertex] = this.centerline[point] + radius * (nx * this.normal.x + nz * this.binormal.x);
    buffer[vertex + 1] = this.centerline[point + 1] + radius * (nx * this.normal.y + nz * this.binormal.y);
    buffer[vertex + 2] = this.centerline[point + 2] + radius * (nx * this.normal.z + nz * this.binormal.z);
  }

  update(progress: number): void {
    if (!Number.isFinite(progress)) throw new RangeError('Prism progress must be finite.');
    const row = Math.max(0, Math.min(1, progress)) * (PRISM_KEYS - 1);
    const key = Math.min(PRISM_KEYS - 2, Math.floor(row)), fraction = row - key;
    const a = key * STRIDE, b = a + STRIDE;
    for (let i = 0; i < STRIDE; i++) {
      this.centerline[i] = this.keys[a + i] + (this.keys[b + i] - this.keys[a + i]) * fraction;
      this.normals[i] = this.normalKeys[a + i] + (this.normalKeys[b + i] - this.normalKeys[a + i]) * fraction;
    }
    for (let i = 0; i <= PRISM_SEGMENTS; i++) {
      this.direction(i, this.tangent);
      this.normal.fromArray(this.normals, i * 3);
      this.normal.addScaledVector(this.tangent, -this.normal.dot(this.tangent)).normalize();
      this.binormal.crossVectors(this.tangent, this.normal).normalize();
      for (let face = 0; face < 4; face++) {
        const n1 = face === 0 || face === 3 ? -1 : 1;
        const z1 = face < 2 ? -1 : 1;
        const next = (face + 1) % 4;
        const n2 = next === 0 || next === 3 ? -1 : 1;
        const z2 = next < 2 ? -1 : 1;
        this.vertex(this.positions, i * 8 + face * 2, i, n1, z1, 0.15);
        this.vertex(this.positions, i * 8 + face * 2 + 1, i, n2, z2, 0.15);
        this.vertex(this.cagePositions, i * 4 + face, i, n1, z1, 0.2);
        if (i === 0 || i === PRISM_SEGMENTS) {
          const index = (i * 4 + face) * 3, capOffset = i ? 0.1 : -0.1;
          this.cagePositions[index] += this.tangent.x * capOffset;
          this.cagePositions[index + 1] += this.tangent.y * capOffset;
          this.cagePositions[index + 2] += this.tangent.z * capOffset;
        }
        const nx = (n1 + n2) / 2, nz = (z1 + z2) / 2;
        for (let corner = 0; corner < 2; corner++) {
          const index = (i * 8 + face * 2 + corner) * 3;
          this.surfaceNormals[index] = nx * this.normal.x + nz * this.binormal.x;
          this.surfaceNormals[index + 1] = nx * this.normal.y + nz * this.binormal.y;
          this.surfaceNormals[index + 2] = nx * this.normal.z + nz * this.binormal.z;
        }
      }
      if (i === 0 || i === PRISM_SEGMENTS) {
        const start = (PRISM_SEGMENTS + 1) * 8 + (i ? 4 : 0);
        for (let side = 0; side < 4; side++) {
          this.vertex(this.positions, start + side, i,
            side === 0 || side === 3 ? -1 : 1, side < 2 ? -1 : 1, 0.15);
          const index = (start + side) * 3, sign = i ? 1 : -1;
          this.surfaceNormals[index] = this.tangent.x * sign;
          this.surfaceNormals[index + 1] = this.tangent.y * sign;
          this.surfaceNormals[index + 2] = this.tangent.z * sign;
        }
      }
    }
    this.positionAttribute.needsUpdate = this.normalAttribute.needsUpdate = this.cageAttribute.needsUpdate = true;
    this.body.computeBoundingBox();
  }

  dispose(): void { this.body.dispose(); this.cage.dispose(); }
}
