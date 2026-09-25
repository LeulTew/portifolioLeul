import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import * as THREE from 'three';
import { Ocean } from './Ocean';
import type { OwnedWater, OwnedWaterOptions } from '@/lib/ocean/OwnedWater';
import { resetFrameGate, setFrameBudget } from '@/lib/render/frameGate';
import { resetCameraHold, setOverlayOcclusion } from '@/lib/camera/cameraHold';
import { OCEAN_TIME_SPEED } from './ocean/oceanConfig';
import { DEFAULT_WAVE_SETTINGS, maxWaveHeight } from './ocean/waveShader';

type FrameCallback = (state: { clock: { elapsedTime: number } }, delta: number) => void;

const harness = vi.hoisted(() => ({
  resources: [] as {
    water: OwnedWater; options: OwnedWaterOptions | undefined;
    targetDisposals: number; materialDisposals: number; geometryDisposals: number;
  }[],
  frame: (() => {}) as FrameCallback,
  reduced: false,
}));

vi.mock('@/lib/ocean/OwnedWater', async (importOriginal) => {
  const { OwnedWater } = await importOriginal<typeof import('@/lib/ocean/OwnedWater')>();
  class RecordedWater extends OwnedWater {
    constructor(...args: ConstructorParameters<typeof OwnedWater>) {
      super(...args);
      const record = {
        water: this, options: args[1], targetDisposals: 0, materialDisposals: 0, geometryDisposals: 0,
      };
      this.reflectionTarget.addEventListener('dispose', () => { record.targetDisposals++; });
      this.material.addEventListener('dispose', () => { record.materialDisposals++; });
      this.geometry.addEventListener('dispose', () => { record.geometryDisposals++; });
      harness.resources.push(record);
    }
  }
  return { OwnedWater: RecordedWater };
});

vi.mock('@react-three/fiber', () => {
  const textures = new Map<string, THREE.Texture>();
  return {
    useFrame: (callback: typeof harness.frame) => { harness.frame = callback; },
    useLoader: (_loader: unknown, url: string) => {
      if (!textures.has(url)) textures.set(url, new THREE.Texture());
      return textures.get(url);
    },
  };
});
vi.mock('@/lib/gateways/animationGateway', () => ({
  usePrefersReducedMotion: () => harness.reduced,
}));

beforeEach(() => {
  harness.resources.length = 0;
  harness.reduced = false;
  resetFrameGate();
  resetCameraHold();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Ocean resource lifetime', () => {
  it.each(['dark', 'light'] as const)('renders the %s surface with its original theme uniforms', theme => {
    render(<Ocean theme={theme} />);
    const { material } = harness.resources[0].water;
    expect(material.uniforms.waterColor.value.getHex()).toBe(theme === 'light' ? 0x2f8db8 : 0x04303a);
    expect(material.uniforms.alpha.value).toBe(theme === 'light' ? 0.92 : 0.95);
    expect(harness.resources[0].water.parent).toBeInstanceOf(THREE.Group);
  });

  it('bounds the reflection skip by the swell the surface is given', () => {
    render(<Ocean theme="light" />);
    expect(harness.resources[0].options?.crestHeight).toBe(maxWaveHeight(DEFAULT_WAVE_SETTINGS));
  });

  it('updates eight themes in place without new reflection targets, shaders or geometry', () => {
    const view = render(<Ocean theme="dark" />);
    const record = harness.resources[0];
    const geometry = record.water.geometry;
    const material = record.water.material;
    const target = record.water.reflectionTarget;
    material.uniforms.time.value = 3.25;
    for (let toggle = 0; toggle < 8; toggle++) {
      const theme = toggle % 2 === 0 ? 'light' : 'dark';
      view.rerender(<Ocean theme={theme} />);
      expect(harness.resources).toHaveLength(1);
      expect(record.water.geometry).toBe(geometry);
      expect(record.water.material).toBe(material);
      expect(record.water.reflectionTarget).toBe(target);
      expect(material.uniforms.time.value).toBe(3.25);
      expect(material.uniforms.waterColor.value.getHex()).toBe(theme === 'light' ? 0x2f8db8 : 0x04303a);
      expect(record.targetDisposals + record.materialDisposals + record.geometryDisposals).toBe(0);
    }
    view.unmount();
    expect(record.water.parent).toBeNull();
    expect(record.targetDisposals).toBe(1);
    expect(record.materialDisposals).toBe(1);
    expect(record.geometryDisposals).toBe(1);
  });

  it('releases every committed StrictMode/remount resource, never cached textures', () => {
    const textureDispose = vi.spyOn(THREE.Texture.prototype, 'dispose');
    for (let cycle = 0; cycle < 4; cycle++) {
      const view = render(<StrictMode><Ocean theme="dark" segments={16} rings={8} /></StrictMode>);
      view.rerender(<StrictMode><Ocean theme="light" segments={16} rings={8} /></StrictMode>);
      view.unmount();
    }
    expect(harness.resources).toHaveLength(8);
    for (const resource of harness.resources) {
      expect(resource.targetDisposals).toBe(1);
      expect(resource.materialDisposals).toBe(1);
      expect(resource.geometryDisposals).toBe(1);
    }
    // WebGLRenderTarget disposal owns its texture through the renderer's
    // target listener; none of the shared loaded images is disposed directly.
    expect(textureDispose).not.toHaveBeenCalled();
  });

  it('releases the old target when a reflection budget is explicitly changed', () => {
    const view = render(<Ocean theme="dark" reflectionSize={512} />);
    view.rerender(<Ocean theme="dark" reflectionSize={256} />);
    expect(harness.resources).toHaveLength(2);
    expect(harness.resources[0].targetDisposals).toBe(1);
    expect(harness.resources[1].water.reflectionTarget.width).toBe(256);
    view.unmount();
    expect(harness.resources[1].targetDisposals).toBe(1);
  });

  it('keeps reduced-motion water static without removing its reflection', () => {
    harness.reduced = true;
    render(<Ocean theme="dark" />);
    const surface = harness.resources[0].water;
    harness.frame({ clock: { elapsedTime: 1 } }, 0.016);
    harness.frame({ clock: { elapsedTime: 2 } }, 0.016);
    expect(surface.material.uniforms.time.value).toBe(0);
    expect(surface.material.uniforms.mirrorSampler.value).toBe(surface.reflectionTarget.texture);
  });

  it('preserves the swell speed at the world budget, without advancing behind an opaque chapter', () => {
    render(<Ocean theme="dark" />);
    const surface = harness.resources[0].water;
    setFrameBudget(1 / 60);
    for (let frame = 0; frame <= 180; frame++) {
      harness.frame({ clock: { elapsedTime: frame / 180 } }, 1 / 180);
    }
    expect(surface.material.uniforms.time.value).toBeCloseTo((1 + 1 / 180) * OCEAN_TIME_SPEED, 10);
    const beforeCover = surface.material.uniforms.time.value;
    setOverlayOcclusion(true, 'skills');
    harness.frame({ clock: { elapsedTime: 2 } }, 1 / 180);
    expect(surface.material.uniforms.time.value).toBe(beforeCover);
    setOverlayOcclusion(false, 'skills');
    harness.frame({ clock: { elapsedTime: 10 } }, 1 / 180);
    expect(surface.material.uniforms.time.value - beforeCover).toBeCloseTo(OCEAN_TIME_SPEED / 180, 10);
  });
});
