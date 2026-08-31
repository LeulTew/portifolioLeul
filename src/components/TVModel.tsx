import { useGLTF, useVideoTexture } from '@react-three/drei';
import { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

/** How long each clip holds the screen before the set changes. */
const CLIP_DURATION_MS = 8000;

type TVModelProps = JSX.IntrinsicElements['group'] & {
  /** How many clips to cycle. One skips the second, heavier file entirely. */
  clips?: number;
};

export function TVModel({ clips = 2, ...props }: TVModelProps) {
  const { scene } = useGLTF('/models/crt-lite.glb', false);
  const [videoIndex, setVideoIndex] = useState(0);

  const texture1 = useVideoTexture('/videos/Spy_Movie_Live_Wallpaper_Video-opt.mp4', {
    start: true,
    muted: true,
    loop: true
  });

  const texture2 = useMemo(() => {
    if (clips < 2) return null;
    if (typeof document === 'undefined') return null;
    const video = document.createElement('video');
    video.src = '/videos/Significant-opt.mp4';
    video.crossOrigin = 'Anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    /*
     * Fetched only as it is needed, and not played until it is shown.
     *
     * This clip is 4.5MB and used to begin downloading and decoding the moment
     * the page mounted, alongside the one actually on screen -- two video
     * decoders running for a prop in the far background, of which only ever
     * one is visible.
     */
    video.preload = 'metadata';
    const tex = new THREE.VideoTexture(video);
    return tex;
  }, [clips]);

  const textures = useMemo(
    () => (texture2 ? [texture1, texture2] : [texture1]),
    [texture1, texture2]
  );
  const currentTexture = textures[videoIndex] || texture1;

  useEffect(() => {
    if (textures.length < 2) return;
    const interval = setInterval(() => {
      setVideoIndex((prev: number) => (prev + 1) % textures.length);
    }, CLIP_DURATION_MS);

    return () => {
      clearInterval(interval);
    };
  }, [textures.length]);

  /*
   * Only the clip on screen decodes.
   *
   * A paused <video> stops feeding frames, so the texture it backs stops being
   * re-uploaded to the GPU as well. Running both continuously spent a decoder
   * and a per-frame texture upload on an image that was not being drawn.
   */
  useEffect(() => {
    textures.forEach((texture, index) => {
      const video = texture?.image;
      if (!video || typeof video.play !== 'function') return;

      if (index === videoIndex) {
        video.preload = 'auto';
        const playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
      } else if (typeof video.pause === 'function') {
        video.pause();
      }
    });
  }, [textures, videoIndex]);

  useEffect(() => {
    return () => {
      if (texture2 && (texture2 as THREE.Texture) !== (texture1 as THREE.Texture)) {
        if (typeof texture2.dispose === 'function') {
          texture2.dispose();
        }
        if (texture2.image && typeof texture2.image.pause === 'function') {
          texture2.image.pause();
          texture2.image.src = '';
        }
      }
    };
  }, [texture2, texture1]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Check for screen or glass in the name
        if (child.name.toLowerCase().includes('screen') || child.name.toLowerCase().includes('glass')) {
            const material = new THREE.MeshBasicMaterial({
                map: currentTexture,
                toneMapped: false,
            });
            child.material = material;
            currentTexture.flipY = false; // GLTF models usually expect flipY false
        }
      }
    });
  }, [scene, currentTexture]);

  return (
    <group {...props} onClick={() => setVideoIndex((prev: number) => (prev + 1) % textures.length)}>
      <primitive object={scene} />

      {/* Video Screen Plane */}
      <group position={[0.145, 0.11, 0.13]} rotation={[-0.03, Math.PI / 2, 0]}>
        <mesh rotation={[0.08, 0, 0]}>
          <planeGeometry args={[0.55, 0.32]} />
          <meshBasicMaterial map={currentTexture} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
