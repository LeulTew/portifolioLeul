import { cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SceneEdgeContinuity } from './SceneEdgeContinuity';
import * as edgeResources from '@/lib/scene/edgeResources';

const useFrame = vi.hoisted(() => vi.fn());
const scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera();

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { scene: THREE.Scene; camera: THREE.Camera }) => unknown) =>
    selector({ scene, camera }),
  useFrame,
}));

function terrain(color: string) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color, map: new THREE.Texture() })
  );
}

function disposeTerrain(mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>) {
  mesh.geometry.dispose();
  mesh.material.map?.dispose();
  mesh.material.dispose();
}

describe('SceneEdgeContinuity lifecycle', () => {
  beforeEach(() => {
    scene.background = new THREE.Color('#f4f7ff');
    scene.fog = new THREE.Fog('#f6f8ff', 34, 78);
    camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    useFrame.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does no frame, timer, or repeated geometry work while mounted', () => {
    const owner = terrain('#e9e2d4');
    const create = vi.spyOn(edgeResources, 'createEdgeResources');
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const interval = vi.spyOn(window, 'setInterval');
    const { rerender, unmount } = renderHook(() => SceneEdgeContinuity({ terrain: owner }));
    rerender();
    rerender();
    expect(create).toHaveBeenCalledTimes(1);
    expect(useFrame).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();
    unmount();
    disposeTerrain(owner);
  });

  it('keeps the committed StrictMode allocation live until the true unmount', () => {
    const owner = terrain('#e9e2d4');
    const originalCreate = edgeResources.createEdgeResources;
    const allocations: ReturnType<typeof originalCreate>[] = [];
    const create = vi.spyOn(edgeResources, 'createEdgeResources').mockImplementation((source) => {
      const next = originalCreate(source);
      [next.skirt.geometry, next.land.geometry, next.horizon.geometry, next.skirt.material, next.horizon.material]
        .forEach(resource => vi.spyOn(resource, 'dispose'));
      allocations.push(next);
      return next;
    });
    const borrowed = vi.spyOn(owner.material.map!, 'dispose');
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { unmount } = renderHook(() => SceneEdgeContinuity({ terrain: owner }), { wrapper });
    expect(create).toHaveBeenCalledTimes(2);
    const [rehearsal, committed] = allocations;
    expect(rehearsal.skirt.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(rehearsal.land.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(rehearsal.horizon.material.dispose).toHaveBeenCalledTimes(1);
    expect(committed.skirt.geometry.dispose).not.toHaveBeenCalled();
    expect(committed.land.geometry.dispose).not.toHaveBeenCalled();
    expect(committed.horizon.material.dispose).not.toHaveBeenCalled();
    unmount();
    [committed.skirt.geometry, committed.land.geometry, committed.horizon.geometry, committed.skirt.material, committed.horizon.material]
      .forEach(resource => expect(resource.dispose).toHaveBeenCalledTimes(1));
    expect(borrowed).not.toHaveBeenCalled();
    disposeTerrain(owner);
  });

  it('hands a theme replacement to new resources and leaves texture disposal to Terrain', () => {
    const light = terrain('#e9e2d4');
    const dark = terrain('#0a1a1a');
    const disposeLightMap = vi.spyOn(light.material.map!, 'dispose');
    const disposeDarkMap = vi.spyOn(dark.material.map!, 'dispose');
    const create = vi.spyOn(edgeResources, 'createEdgeResources');
    const { rerender, unmount } = renderHook(
      ({ owner }) => SceneEdgeContinuity({ terrain: owner }),
      { initialProps: { owner: light } }
    );
    const previous = create.mock.results[0].value;
    const disposePrevious = vi.spyOn(previous, 'dispose');
    scene.background = new THREE.Color('#001a1a');
    scene.fog = new THREE.Fog('#001a1a', 34, 78);
    rerender({ owner: dark });
    const current = create.mock.results[1].value;
    expect(disposePrevious).toHaveBeenCalledTimes(1);
    expect(current.skirt.material.map).toBe(dark.material.map);
    expect(current.horizon.material.uniforms.backgroundColor.value).toBe(scene.background);
    unmount();
    expect(disposeLightMap).not.toHaveBeenCalled();
    expect(disposeDarkMap).not.toHaveBeenCalled();
    disposeTerrain(light);
    disposeTerrain(dark);
  });

  it('releases only its own bit when the active main camera changes or unmounts', () => {
    const owner = terrain('#e9e2d4');
    const initialCamera = camera;
    initialCamera.layers.enable(4);
    const { rerender, unmount } = renderHook(() => SceneEdgeContinuity({ terrain: owner }));
    expect(initialCamera.layers.isEnabled(edgeResources.HORIZON_LAYER)).toBe(true);
    camera = new THREE.PerspectiveCamera();
    camera.layers.enable(6);
    rerender();
    expect(initialCamera.layers.mask).toBe((1 << 0) | (1 << 4));
    expect(camera.layers.mask).toBe((1 << 0) | (1 << 1) | (1 << 6));
    unmount();
    expect(camera.layers.mask).toBe((1 << 0) | (1 << 6));
    disposeTerrain(owner);
  });

  it('selects the profile belonging to the mounted software terrain without a new frame loop', () => {
    const owner = terrain('#e9e2d4');
    const create = vi.spyOn(edgeResources, 'createEdgeResources');
    const { rerender, unmount } = renderHook(
      ({ softwareRenderer }) => SceneEdgeContinuity({ terrain: owner, softwareRenderer }),
      { initialProps: { softwareRenderer: false } },
    );
    const previous = create.mock.results[0].value;
    const disposed = vi.spyOn(previous, 'dispose');
    rerender({ softwareRenderer: true });
    expect(create).toHaveBeenLastCalledWith(owner, 'light', true);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(useFrame).not.toHaveBeenCalled();
    unmount();
    disposeTerrain(owner);
  });
});
