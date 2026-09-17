import { extend, type BufferGeometryNode } from '@react-three/fiber';
import { CrtSupportGeometry } from '@/lib/projects/crtSupportGeometry';
import { TV_SCREEN_WORLD } from '@/lib/projects/tvScreen';

extend({ CrtSupportGeometry });

declare module '@react-three/fiber' {
  interface ThreeElements {
    crtSupportGeometry: BufferGeometryNode<CrtSupportGeometry, typeof CrtSupportGeometry>;
  }
}

export function CRTSupports() {
  return (
    <mesh name="crt-grounded-supports">
      <crtSupportGeometry args={[TV_SCREEN_WORLD]} />
      <meshStandardMaterial color="#343a33" roughness={0.88} metalness={0.12} envMapIntensity={0.55} />
    </mesh>
  );
}
