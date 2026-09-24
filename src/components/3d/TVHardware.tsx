import { useLayoutEffect, useRef } from 'react';
import { extend, useFrame, useThree, type BufferGeometryNode } from '@react-three/fiber';
import {
  registerTVHardware, TV_CONTROL_IDS, TVHardwareMotion,
} from '@/lib/tv/tvHardware';
import { TvHardwareGeometry } from '@/lib/tv/tvHardwareGeometry';

extend({ TvHardwareGeometry });

declare module '@react-three/fiber' {
  interface ThreeElements {
    tvHardwareGeometry: BufferGeometryNode<TvHardwareGeometry, typeof TvHardwareGeometry>;
  }
}

export interface TVHardwareProps {
  powered: boolean;
}

/** Sibling of CRTHousing inside the existing screen-pitch group; never owns clicks. */
export function TVHardware({ powered }: TVHardwareProps) {
  const geometry = useRef<TvHardwareGeometry>(null);
  const motionRef = useRef<TVHardwareMotion>();
  if (!motionRef.current) motionRef.current = new TVHardwareMotion(powered);
  const motion = motionRef.current;
  const hidden = useRef(false);
  const invalidate = useThree(state => state.invalidate);

  useLayoutEffect(() => {
    motion.setPowered(powered);
    if (hidden.current) motion.reset();
    for (const id of TV_CONTROL_IDS) geometry.current?.setDepth(id, motion.depth(id));
    if (!hidden.current) invalidate();
  }, [powered, motion, invalidate]);

  useLayoutEffect(() => {
    const meshGeometry = geometry.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      for (const id of TV_CONTROL_IDS) meshGeometry?.setDepth(id, motion.depth(id));
      if (!hidden.current) invalidate();
    };
    const reset = () => {
      motion.reset();
      apply();
    };
    const visibility = () => {
      hidden.current = document.visibilityState === 'hidden';
      reset();
    };
    const reducedMotion = () => {
      motion.setReducedMotion(media.matches);
      apply();
    };
    const unregister = registerTVHardware((id, kind, active) => {
      // Hover/focus edges belong to the projected native button, not another effect.
      if (kind !== 'press' || hidden.current) return;
      motion.setPressed(id, active);
      apply();
    });
    reducedMotion();
    visibility();
    media.addEventListener('change', reducedMotion);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', reset);
    return () => {
      unregister();
      media.removeEventListener('change', reducedMotion);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', reset);
      motion.reset();
      for (const id of TV_CONTROL_IDS) meshGeometry?.setDepth(id, motion.depth(id));
    };
  }, [motion, invalidate]);

  useFrame((_state, delta) => {
    if (hidden.current || !motion.moving) return;
    motion.step(Math.min(delta, 0.05));
    for (const id of TV_CONTROL_IDS) geometry.current?.setDepth(id, motion.depth(id));
    if (motion.moving) invalidate();
  });

  return (
    <mesh name="crt-moving-control-caps">
      <tvHardwareGeometry ref={geometry} />
      <meshStandardMaterial vertexColors roughness={0.4} metalness={0.52} />
    </mesh>
  );
}
