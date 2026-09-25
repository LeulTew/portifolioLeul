import { Canvas, type CanvasProps } from '@react-three/fiber';
import type { GpuTierConfig } from '@/lib/gateways/gpuTier';
import { useWorldQuality } from '@/lib/render/worldQuality';
import { RenderGovernor } from './RenderGovernor';

export interface WorldCanvasProps extends Omit<CanvasProps, 'dpr'> {
  tier: Pick<GpuTierConfig, 'maxFps' | 'dpr'>;
}

/**
 * The page's canvas, drawn at the world's current quality: the GPU tier's own
 * until sustained frame pressure lowers it (see `worldQuality`). A change of
 * quality re-renders only this component; the scene it is handed is the same
 * element, so nothing inside it renders again or loses its state.
 */
export function WorldCanvas({ tier, children, ...props }: WorldCanvasProps) {
  const quality = useWorldQuality(tier);
  return (
    <Canvas {...props} dpr={quality.dpr}>
      {children}
      {/*
        Owns the render call, so frames behind an opaque section -- and frames
        above the redraw ceiling -- are never drawn. Its priority puts it after
        every other frame subscriber wherever it is mounted.
      */}
      <RenderGovernor maxFps={quality.maxFps} quality={quality.level} />
    </Canvas>
  );
}
