import { useGLTF, useVideoTexture } from '@react-three/drei';
import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function TVModel(props: JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF('/models/crt-opt.glb');
  const [videoIndex, setVideoIndex] = useState(0);
  
  const texture1 = useVideoTexture('/videos/Spy_Movie_Live_Wallpaper_Video-opt.mp4', {
    start: true,
    muted: true,
    loop: true
  });
  
  const video = document.createElement('video');
  video.src = '/videos/Significant-opt.mp4';
  video.crossOrigin = 'Anonymous';
  video.loop = true;
  video.muted = true;
  video.play();
  const texture2 = new THREE.VideoTexture(video);

  const textures = [texture1, texture2];
  const currentTexture = textures[videoIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setVideoIndex((prev: number) => (prev + 1) % textures.length);
    }, 8000); // Switch every 8 seconds

    return () => clearInterval(interval);
  }, [textures.length]);

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
