import { extend, type BufferGeometryNode, type MaterialNode } from '@react-three/fiber';
import { CrtSpeakerCabinetGeometry } from '@/lib/projects/crtSpeakerCabinetGeometry';
import { CrtSpeakerGrilleMaterial } from '@/lib/projects/crtSpeakerGrilleMaterial';
import { TV_SCREEN_WORLD } from '@/lib/projects/tvScreen';

extend({ CrtSpeakerCabinetGeometry, CrtSpeakerGrilleMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    crtSpeakerCabinetGeometry: BufferGeometryNode<CrtSpeakerCabinetGeometry, typeof CrtSpeakerCabinetGeometry>;
    crtSpeakerGrilleMaterial: MaterialNode<CrtSpeakerGrilleMaterial, typeof CrtSpeakerGrilleMaterial>;
  }
}

export function CRTSpeakerCabinet() {
  return (
    <group name="crt-integral-speaker-cabinet">
      <mesh name="crt-full-width-lower-enclosure">
        <crtSpeakerCabinetGeometry args={['shell', TV_SCREEN_WORLD]} />
        <meshStandardMaterial vertexColors roughness={0.68} metalness={0.12} />
      </mesh>
      <mesh name="crt-broad-inset-speaker-grille">
        <crtSpeakerCabinetGeometry args={['grille', TV_SCREEN_WORLD]} />
        <crtSpeakerGrilleMaterial />
      </mesh>
      <mesh name="crt-speaker-cabinet-satin-brow">
        <crtSpeakerCabinetGeometry args={['trim', TV_SCREEN_WORLD]} />
        <meshStandardMaterial color="#8c8e82" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}
