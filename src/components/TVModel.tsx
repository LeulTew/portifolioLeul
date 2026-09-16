import { useGLTF, useVideoTexture } from '@react-three/drei';
import { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { resolveSceneModel } from '@/lib/assets/criticalAssets';
import { useProjectsActive } from '@/lib/projects/projectsScene';
import {
  TV_SCREEN_POSITION, TV_SCREEN_ROTATION, TV_SCREEN_PITCH, TV_SCREEN_WIDTH, TV_SCREEN_HEIGHT,
} from '@/lib/projects/tvScreen';
import { TVScreenProjection } from './3d/TVScreenProjection';

/** How long each clip holds the screen before the set changes. */
const CLIP_DURATION_MS = 8000;

type TVModelProps = JSX.IntrinsicElements['group'] & {
  /** How many clips to cycle. One skips the second, heavier file entirely. */
  clips?: number;
};

export function TVModel({ clips = 2, ...props }: TVModelProps) {
  const { scene } = useGLTF(resolveSceneModel('/models/crt-lite.glb'), false);
  const [videoIndex, setVideoIndex] = useState(0);
  const projectsActive = useProjectsActive();

  /*
   * Not started here.
   *
   * drei would call play() itself and leave the promise unhandled, and a
   * browser that pauses an offscreen video to save power -- which it does,
   * this being a prop in the far background -- rejects that promise. It
   * surfaced on the deployed site as an uncaught AbortError. Playback is owned
   * by the effect below, which drives the visible clip and handles the
   * rejection.
   */
  const texture1 = useVideoTexture('/videos/Spy_Movie_Live_Wallpaper_Video-opt.mp4', {
    start: false,
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
    if (textures.length < 2 || projectsActive) return;
    const interval = setInterval(() => {
      setVideoIndex((prev: number) => (prev + 1) % textures.length);
    }, CLIP_DURATION_MS);

    return () => {
      clearInterval(interval);
    };
  }, [textures.length, projectsActive]);

  /*
   * Only the clip on screen decodes.
   *
   * A paused <video> stops feeding frames, so the texture it backs stops being
   * re-uploaded to the GPU as well. Running both continuously spent a decoder
   * and a per-frame texture upload on an image that was not being drawn.
   */
  useEffect(() => {
    const updatePlayback = () => textures.forEach((texture, index) => {
      const video = texture?.image;
      if (!video || typeof video.play !== 'function') return;

      if (index === videoIndex && !projectsActive && !document.hidden) {
        video.preload = 'auto';
        const playing = video.play();
        if (playing && typeof playing.catch === 'function') playing.catch((error: unknown) => {
          if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) return;
          console.warn('TV ambient video could not play:', error);
        });
      } else if (typeof video.pause === 'function') {
        video.pause();
      }
    });
    updatePlayback();
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      document.removeEventListener('visibilitychange', updatePlayback);
      textures.forEach(texture => texture?.image?.pause?.());
    };
  }, [textures, videoIndex, projectsActive]);

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

  return (
    <group {...props} onClick={() => {
      if (!projectsActive) setVideoIndex((prev: number) => (prev + 1) % textures.length);
    }}>
      {/* The textured body and its geometry belong to the shared GLTF cache. */}
      <primitive object={scene} dispose={null} />

      {/* Video Screen Plane */}
      <group position={[...TV_SCREEN_POSITION]} rotation={[...TV_SCREEN_ROTATION]}>
        <mesh rotation={[TV_SCREEN_PITCH, 0, 0]}>
          <planeGeometry args={[TV_SCREEN_WIDTH, TV_SCREEN_HEIGHT]} />
          <meshBasicMaterial map={currentTexture} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <TVScreenProjection />
    </group>
  );
}
