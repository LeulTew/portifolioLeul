import * as THREE from 'three';
import { setTVMediaStatus } from './tvState';

export const TV_VIDEO_URL = '/videos/Spy_Movie_Live_Wallpaper_Video-opt.mp4';

/** r161's VideoTexture does not cancel its video-frame callback on disposal. */
export class TVVideoTexture extends THREE.Texture {
  readonly isVideoTexture = true;
  private handle = 0;
  private active = false;
  private time = -1;
  private disposed = false;

  constructor(private video: HTMLVideoElement) {
    super(video);
    this.minFilter = this.magFilter = THREE.LinearFilter;
    this.generateMipmaps = false;
    this.colorSpace = THREE.SRGBColorSpace;
  }

  private frame = () => {
    this.handle = 0;
    if (!this.active || this.disposed) return;
    this.needsUpdate = true;
    this.handle = this.video.requestVideoFrameCallback(this.frame);
  };

  setActive(active: boolean): void {
    this.active = active;
    if (!active && this.handle) {
      this.video.cancelVideoFrameCallback(this.handle);
      this.handle = 0;
    }
    if (active && !this.handle && typeof this.video.requestVideoFrameCallback === 'function') {
      this.handle = this.video.requestVideoFrameCallback(this.frame);
    }
  }

  update(): void {
    if (!this.active || this.disposed || typeof this.video.requestVideoFrameCallback === 'function') return;
    if (this.video.readyState >= 2 && this.video.currentTime !== this.time) {
      this.time = this.video.currentTime;
      this.needsUpdate = true;
    }
  }

  dispose(): void {
    this.setActive(false);
    this.disposed = true;
    super.dispose();
  }
}

export class TVBroadcastMedia {
  texture: TVVideoTexture | null = null;
  private video: HTMLVideoElement | null = null;
  private active = false;
  private generation = 0;
  private disposed = false;
  private stalled = false;

  constructor(private changed: (texture: THREE.Texture | null, ready: boolean) => void,
    private createVideo = () => document.createElement('video')) {}

  private ready = () => {
    if (!this.video || this.disposed) return;
    if (!this.active && !this.texture) return;
    if (!this.texture) {
      this.texture = new TVVideoTexture(this.video);
      this.texture.setActive(this.active);
    }
    this.changed(this.texture, this.active && !this.stalled);
  };

  private failed = () => {
    if (this.disposed || !this.active) return;
    this.stalled = true;
    this.video?.pause();
    this.texture?.setActive(false);
    this.changed(this.texture, false);
    console.warn('TV broadcast could not be loaded; showing the local test card.');
    setTVMediaStatus('error', 'Video unavailable. The test card is showing; switch channels or turn the TV off and on to retry.');
  };

  sync(active: boolean): void {
    if (this.disposed || active === this.active) return;
    this.active = active;
    const ticket = ++this.generation;
    if (!active) {
      this.video?.pause();
      this.texture?.setActive(false);
      this.changed(this.texture, !!this.texture && !this.stalled);
      setTVMediaStatus('idle');
      return;
    }
    this.stalled = false;
    if (!this.video) {
      this.video = this.createVideo();
      this.video.muted = true;
      this.video.loop = true;
      this.video.playsInline = true;
      this.video.preload = 'none';
      this.video.addEventListener('loadeddata', this.ready);
      this.video.addEventListener('error', this.failed);
      this.video.src = TV_VIDEO_URL;
    } else if (this.video.error) {
      this.video.load();
    }
    setTVMediaStatus('loading');
    let playing: Promise<void> | undefined;
    try { playing = this.video.play(); }
    catch { this.failed(); return; }
    if (!playing) { this.ready(); setTVMediaStatus('playing'); return; }
    playing.then(() => {
      if (this.disposed || ticket !== this.generation || !this.active) return;
      this.ready();
      this.texture?.setActive(true);
      setTVMediaStatus('playing');
    }, (error: unknown) => {
      if (this.disposed || ticket !== this.generation || !this.active) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.stalled = true;
        this.texture?.setActive(false);
        this.changed(this.texture, false);
        setTVMediaStatus('blocked', 'Video playback was blocked. Turn the TV off and on to retry; the local test card remains available.');
      } else this.failed();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.active = false;
    this.generation++;
    if (this.video) {
      this.video.pause();
      this.video.removeEventListener('loadeddata', this.ready);
      this.video.removeEventListener('error', this.failed);
      this.video.removeAttribute('src');
      this.video.load();
    }
    this.texture?.dispose();
    this.texture = null;
    this.video = null;
    this.changed(null, false);
  }
}
