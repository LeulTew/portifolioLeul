import type { GpuTierConfig } from '@/lib/gateways/gpuTier';
import type { ContactMode } from './contactScene';

export const CONTACT_CLOUD_LAYER = 2;

export type ContactCloudTexture = 'body' | 'vapor';

export interface ContactCloudQuad {
  readonly bank: 'left' | 'right' | 'crown';
  readonly texture: ContactCloudTexture;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

const RIGHT_BODY: ContactCloudQuad = {
  bank: 'right', texture: 'body',
  x: 28.7, y: 9.7, depth: 36, width: 24, height: 6.5, rotation: 0.12,
};
const LEFT_BODY: ContactCloudQuad = {
  bank: 'left', texture: 'body',
  x: -22.3, y: 1.6, depth: 26, width: 20, height: 8.5, rotation: -0.21,
};
const LOW_CLOUDS: readonly ContactCloudQuad[] = [RIGHT_BODY, LEFT_BODY];
const FULL_CLOUDS: readonly ContactCloudQuad[] = [
  {
    bank: 'crown', texture: 'vapor',
    x: -5, y: 20.9, depth: 43, width: 27, height: 5.7, rotation: -0.055,
  },
  RIGHT_BODY,
  {
    bank: 'right', texture: 'vapor',
    x: 28.8, y: 7, depth: 34, width: 26, height: 4.2, rotation: -0.14,
  },
  LEFT_BODY,
  {
    bank: 'left', texture: 'vapor',
    x: -23, y: 6.8, depth: 25, width: 23, height: 4.4, rotation: 0.07,
  },
];

export function getContactCloudQuads(
  gpu: Pick<GpuTierConfig, 'tier' | 'softwareRenderer'>,
): readonly ContactCloudQuad[] {
  return gpu.tier === 'low' || gpu.softwareRenderer ? LOW_CLOUDS : FULL_CLOUDS;
}

export function getContactCloudOpacity(mode: ContactMode, progress: number): number {
  if (!Number.isFinite(progress)) throw new RangeError('Contact cloud progress must be finite.');
  if (mode === 'outside') return 0;
  const t = Math.max(0, Math.min(1, (progress - 0.24) / 0.66));
  return t * t * (3 - 2 * t);
}
