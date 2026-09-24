import * as THREE from 'three';
import { AvatarAcknowledgement } from '@/lib/avatar/avatarRig';

/** One visible-time mixer, followed by the encounter's additive pose. */
export class AvatarAnimation {
  readonly mixer: THREE.AnimationMixer;
  private actions: THREE.AnimationAction[];
  private sampled = false;
  private reduced = false;
  private suspended = false;
  private disposed = false;

  constructor(
    private readonly root: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
    private readonly acknowledgement: AvatarAcknowledgement,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.actions = clips.map(clip => this.mixer.clipAction(clip).reset().fadeIn(0.5).play());
  }

  update(delta: number, attention: number, nod: number, reducedMotion: boolean): void {
    if (this.disposed) return;
    this.suspended = false;
    if (reducedMotion) {
      if (!this.reduced) this.acknowledgement.restore();
      // A reduced-motion first visit still needs the authored clip's first
      // pose, not the rig's bind/T-pose. Sample it once, then do no mixer work.
      if (!this.sampled && this.actions.length > 0) {
        for (const action of this.actions) action.stopFading().setEffectiveWeight(1);
        this.mixer.update(0);
        this.sampled = true;
      }
      this.reduced = true;
      return;
    }
    this.reduced = false;
    // Restore BEFORE evaluating tracks: untracked acknowledgement joints
    // otherwise accumulate offsets, while tracked ones overwrite the base.
    this.acknowledgement.restore();
    if (this.actions.length > 0) {
      this.mixer.update(Math.min(0.1, Math.max(0, Number.isFinite(delta) ? delta : 0)));
      this.sampled = true;
    }
    this.acknowledgement.apply(attention, nod);
  }

  suspend(): void {
    if (this.disposed || this.suspended) return;
    this.acknowledgement.restore();
    this.suspended = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.acknowledgement.restore();
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.length = 0;
    this.disposed = true;
  }
}
