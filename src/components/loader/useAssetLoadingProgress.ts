import { useState, useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';

export interface AssetLoadingState {
  progress: number;
  rawProgress: number;
  isReady: boolean;
  active: boolean;
  loaded: number;
  total: number;
  statusMessage: string;
}

interface UseAssetLoadingProgressOptions {
  minDurationMs?: number;
  onComplete?: () => void;
}

export function useAssetLoadingProgress(options: UseAssetLoadingProgressOptions = {}): AssetLoadingState {
  const { minDurationMs = 1400, onComplete } = options;
  const { active, progress: rawProgress, loaded, total } = useProgress();

  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const timeRatio = Math.min(elapsed / minDurationMs, 1);
      
      let targetProgress = 0;
      if (total > 0 && active) {
        targetProgress = Math.min(rawProgress, timeRatio * 100);
      } else if (rawProgress >= 100 || !active || total === 0) {
        targetProgress = timeRatio * 100;
      } else {
        targetProgress = rawProgress;
      }

      const isFinished = timeRatio >= 1 && (rawProgress >= 100 || !active || total === 0);

      if (isFinished) {
        if (!completedRef.current) {
          completedRef.current = true;
          setDisplayedProgress(100);
          setIsReady(true);
          onComplete?.();
        }
        return;
      }

      setDisplayedProgress((prev) => {
        const next = prev + (targetProgress - prev) * 0.16;
        return Math.min(Math.round(next * 10) / 10, 100);
      });

      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [rawProgress, active, total, minDurationMs, onComplete]);

  const getStatusMessage = (val: number): string => {
    if (val < 25) return 'INITIALIZING_GRAPHICS_PIPELINE';
    if (val < 55) return 'DECODING_3D_MESHES_AND_BUFFERS';
    if (val < 85) return 'COMPILING_GLSL_WATER_SHADERS';
    if (val < 100) return 'OPTIMIZING_GPU_VRAM_BUFFERS';
    return 'SYSTEM_READY_STANDBY_ONLINE';
  };

  return {
    progress: displayedProgress,
    rawProgress,
    isReady,
    active,
    loaded,
    total,
    statusMessage: getStatusMessage(displayedProgress),
  };
}
