import * as THREE from 'three';
import { CRT_SPEAKER_GRILLE } from './crtSpeakerCabinetGeometry';

export const CRT_GRILLE_TILE_SIZE = 32;

function createPerforationTexture(): THREE.DataTexture {
  const size = CRT_GRILLE_TILE_SIZE;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5);
      const bore = THREE.MathUtils.smoothstep(radius, 0.2, 0.3);
      const lip = THREE.MathUtils.smoothstep(radius, 0.3, 0.38);
      const value = Math.round(54 + bore * 181 - lip * 22);
      const offset = (y * size + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'crt-owned-perforated-grille';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(160, 160 * (CRT_SPEAKER_GRILLE.top - CRT_SPEAKER_GRILLE.bottom) / CRT_SPEAKER_GRILLE.width);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** One opaque, mipmapped tile supplies both the perforations and their shallow relief. */
export class CrtSpeakerGrilleMaterial extends THREE.MeshStandardMaterial {
  private readonly perforations: THREE.DataTexture;

  constructor() {
    const perforations = createPerforationTexture();
    super({
      color: '#787c70',
      roughness: 0.8,
      metalness: 0.12,
      map: perforations,
      bumpMap: perforations,
      bumpScale: 0.0003,
    });
    this.name = 'crt-speaker-grille-material';
    this.perforations = perforations;
  }

  override dispose() {
    this.perforations.dispose();
    super.dispose();
  }
}
