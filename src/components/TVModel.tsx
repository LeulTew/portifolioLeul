import { useGLTF, useVideoTexture } from '@react-three/drei';
import { useEffect } from 'react';
import * as THREE from 'three';

export function TVModel(props: JSX.IntrinsicElements['group']) {
  const { scene } = useGLTF('/models/crt.glb');
  const texture = useVideoTexture('/videos/Spy_Movie_Live_Wallpaper_Video.mp4', {
    start: true,
    muted: true,
    loop: true
  });

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Check for screen or glass in the name
        if (child.name.toLowerCase().includes('screen') || child.name.toLowerCase().includes('glass')) {
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                toneMapped: false,
            });
            child.material = material;
            texture.flipY = false; // GLTF models usually expect flipY false
        }
      }
    });
    
    // If no specific screen mesh found, maybe apply to a specific known mesh name if we knew it
    // For now, we hope 'screen' works.
  }, [scene, texture]);

  return (
    <group {...props}>
      <primitive object={scene} />
      
      {/* Video Screen Plane */}
      <group position={[0.15, 0.1, 0.13]} rotation={[-0.03, Math.PI / 2, 0]}>
        <mesh rotation={[0.08, 0, 0]}>
          <planeGeometry args={[0.55, 0.32]} />
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </group>


    </group>
  );
}
