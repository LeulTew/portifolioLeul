import { extend, type BufferGeometryNode } from '@react-three/fiber';
import { CrtHousingGeometry } from '@/lib/projects/crtHousingGeometry';

extend({ CrtHousingGeometry });

declare module '@react-three/fiber' {
  interface ThreeElements {
    crtHousingGeometry: BufferGeometryNode<CrtHousingGeometry, typeof CrtHousingGeometry>;
  }
}

export interface CRTHousingProps {
  active?: boolean;
}

/**
 * Mount beside the display plane, inside its position/rotation AND pitch groups.
 * No screen surface, lights, textures, frame loop or interaction handlers live here.
 * Each declared geometry/material belongs to R3F.
 */
export function CRTHousing({ active = false }: CRTHousingProps) {
  return (
    <group name="authored-crt-housing">
      <mesh name="crt-cabinet">
        <crtHousingGeometry args={['cabinet']} />
        <meshStandardMaterial color="#45443f" roughness={0.58} metalness={0.14} />
      </mesh>
      <mesh name="crt-tapered-back">
        <crtHousingGeometry args={['rear']} />
        <meshStandardMaterial color="#2b2c28" roughness={0.76} metalness={0.06} />
      </mesh>
      <mesh name="crt-display-well-and-recesses">
        <crtHousingGeometry args={['recess']} />
        <meshStandardMaterial color="#111613" roughness={0.68} metalness={0.05} />
      </mesh>
      <mesh name="crt-satin-trim-and-control-bezels">
        <crtHousingGeometry args={['metal']} />
        <meshStandardMaterial color="#8c8e82" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh name="crt-glass-edge">
        <crtHousingGeometry args={['glassEdge']} />
        <meshStandardMaterial
          color="#53625b"
          roughness={0.16}
          metalness={0.24}
          envMapIntensity={0.8}
        />
      </mesh>
      <mesh name="crt-power-indicator">
        <crtHousingGeometry args={['indicator']} />
        <meshStandardMaterial
          color={active ? '#abc5a4' : '#33382e'}
          emissive={active ? '#82aa77' : '#000000'}
          emissiveIntensity={active ? 0.32 : 0}
          roughness={0.28}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
