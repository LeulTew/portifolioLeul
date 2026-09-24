import * as THREE from 'three';

interface Joint {
  bone: THREE.Object3D;
  yaw: number;
  pitch: number;
  base: THREE.Quaternion;
  applied: THREE.Quaternion;
  changed: boolean;
}

/** Adds attention after the original mixer, without retiming its wave or moving the feet. */
export class AvatarAcknowledgement {
  private joints: Joint[] = [];
  private offset = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  readonly supported: boolean;

  constructor(scene: THREE.Object3D) {
    const specifications = [
      ['Spine2', 0.24, 0.025],
      ['Neck', 0.12, 0.04],
      ['Head', 0.18, 0.13],
    ] as const;
    for (const [name, yaw, pitch] of specifications) {
      const bone = scene.getObjectByName(`mixamorig${name}`) ?? scene.getObjectByName(`mixamorig:${name}`);
      if (bone) this.joints.push({
        bone, yaw, pitch, base: new THREE.Quaternion(), applied: new THREE.Quaternion(), changed: false,
      });
    }
    this.supported = this.joints.length === specifications.length;
    if (!this.supported) console.warn('Avatar acknowledgement joints are unavailable; keeping the normal scene.');
  }

  restore(): void {
    for (const joint of this.joints) {
      // The mixer may already have supplied a newer base on an undrawn frame.
      if (joint.changed && joint.bone.quaternion.equals(joint.applied)) joint.bone.quaternion.copy(joint.base);
      joint.changed = false;
    }
  }

  apply(attention: number, nod: number): void {
    this.restore();
    if (!this.supported || attention <= 0) return;
    for (const joint of this.joints) {
      joint.base.copy(joint.bone.quaternion);
      this.euler.set(joint.pitch * nod * attention, joint.yaw * attention, 0);
      joint.bone.quaternion.multiply(this.offset.setFromEuler(this.euler));
      joint.applied.copy(joint.bone.quaternion);
      joint.changed = true;
    }
  }
}
