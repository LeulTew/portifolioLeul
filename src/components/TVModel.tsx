import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { getPrefersReducedMotion } from '@/lib/gateways/animationGateway';
import { drawnFrameDelta, isFrameDrawn, isWorldOccluded } from '@/lib/render/frameGate';
import { getContactView } from '@/lib/contact/contactScene';
import { getTVState, setTVExposure, subscribeTV, useTVState } from '@/lib/tv/tvState';
import { TVBroadcastMedia } from '@/lib/tv/tvMedia';
import { TVScreenMaterial } from '@/lib/tv/tvScreenMaterial';
import { TVControlProjection } from '@/lib/tv/tvControlProjection';
import {
  TV_SCREEN_POSITION, TV_SCREEN_ROTATION, TV_SCREEN_PITCH, TV_SCREEN_WIDTH, TV_SCREEN_HEIGHT,
} from '@/lib/projects/tvScreen';
import { TVScreenProjection } from './3d/TVScreenProjection';
import { CRTHousing } from './3d/CRTHousing';
import { CRTSpeakerCabinet } from './3d/CRTSpeakerCabinet';
import { TVHardware } from './3d/TVHardware';

type TVModelProps = JSX.IntrinsicElements['group'] & {
  /** The existing tier budget also selects the simpler CRT treatment. */
  clips?: number;
};

export function TVModel({ clips = 2, ...props }: TVModelProps) {
  const state = useTVState();
  const screen = useMemo(() => new TVScreenMaterial(clips > 1), [clips]);
  const projection = useMemo(() => new TVControlProjection(), []);

  useEffect(() => {
    const media = new TVBroadcastMedia((texture, ready) => screen.setVideo(texture, ready));
    const sync = () => {
      const tv = getTVState();
      media.sync(tv.source === 'broadcast' && tv.channel === 0 && tv.exposed && !document.hidden);
    };
    const visibility = () => {
      if (document.hidden) setTVExposure(false, 'hidden');
      sync();
    };
    const release = subscribeTV(sync);
    document.addEventListener('visibilitychange', visibility);
    sync();
    return () => {
      release();
      document.removeEventListener('visibilitychange', visibility);
      media.dispose();
      setTVExposure(false, 'hidden');
      screen.dispose();
    };
  }, [screen]);

  useFrame((frame, delta) => {
    if (document.hidden || isWorldOccluded() || getContactView().mode !== 'outside') {
      setTVExposure(false, 'hidden');
      return;
    }
    if (!isFrameDrawn(frame.clock.elapsedTime)) return;
    projection.paint(frame.camera, frame.size.width, frame.size.height);
    const tv = getTVState();
    screen.update(tv.source, tv.channel, tv.commandRevision,
      drawnFrameDelta(frame.clock.elapsedTime, delta) * 1000, getPrefersReducedMotion(), projection.screenPixels, tv.exposed);
  });

  return (
    <group {...props}>
      <group position={[...TV_SCREEN_POSITION]} rotation={[...TV_SCREEN_ROTATION]}>
        <group rotation={[TV_SCREEN_PITCH, 0, 0]}>
          <CRTHousing active={state.source !== 'off'} />
          <CRTSpeakerCabinet />
          <TVHardware powered={state.source !== 'off'} />
          <mesh name="tv-display-signal">
            <planeGeometry args={[TV_SCREEN_WIDTH, TV_SCREEN_HEIGHT]} />
            {/* Primitives are not auto-disposed; null would overwrite our owned disposer. */}
            <primitive object={screen} attach="material" />
          </mesh>
        </group>
      </group>
      <TVScreenProjection />
    </group>
  );
}
