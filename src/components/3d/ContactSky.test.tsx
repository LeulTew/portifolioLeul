import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CONTACT_SKY_ORIENTATION, CONTACT_SKY_POSITION } from '@/lib/camera/contactFlight';
import { CONTACT_CLOUD_LAYER, getContactCloudOpacity } from '@/lib/contact/contactClouds';
import type { ContactMode } from '@/lib/contact/contactScene';
import type { GpuTierConfig } from '@/lib/gateways/gpuTier';
import { ContactSky } from './ContactSky';

type CloudMesh = THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
type FrameState = { clock: { elapsedTime: number } };

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let frameCallback: ((state: FrameState) => void) | null = null;
const gl = { initTexture: vi.fn() };
const gpu: Pick<GpuTierConfig, 'tier' | 'softwareRenderer'> = {
  tier: 'high', softwareRenderer: false,
};
const contact: { mode: ContactMode; progress: number; revision: number; committed: number } = {
  mode: 'outside', progress: 0, revision: 0, committed: -1,
};
const frameGate = vi.fn<(time: number) => boolean>();
const gpuReading = vi.fn(() => gpu);

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; gl: typeof gl }) => unknown) =>
    selector({ scene, camera, gl }),
  useFrame: (callback: (state: FrameState) => void) => { frameCallback = callback; },
}));
vi.mock('@/lib/gateways/gpuTier', () => ({ getGpuTier: () => gpuReading() }));
vi.mock('@/lib/contact/contactScene', () => ({ getContactView: () => contact }));
vi.mock('@/lib/render/frameGate', () => ({
  isFrameDrawn: (time: number) => frameGate(time),
}));

interface TextureRequest {
  url: string;
  manager: THREE.LoadingManager;
  texture: THREE.Texture;
  resolve: () => void;
  reject: (error: Error) => void;
}

let requests: TextureRequest[] = [];
let synchronousLoadError: Error | null = null;
const frame = (elapsedTime = 1) => frameCallback?.({ clock: { elapsedTime } });
const cloudRoot = () => scene.getObjectByName('Contact sky') as THREE.Group;
const cloudMeshes = () => cloudRoot().children as CloudMesh[];
const loadTextures = () => requests.forEach(request => request.resolve());
const park = () => { contact.mode = 'parked'; contact.progress = 1; };
const depart = (progress = 0) => {
  contact.mode = 'departing';
  contact.progress = progress;
  contact.revision++;
};

function watchVisibility(object: THREE.Object3D) {
  let visible = object.visible;
  const write = vi.fn((value: boolean) => { visible = value; });
  Object.defineProperty(object, 'visible', {
    configurable: true,
    get: () => visible,
    set: write,
  });
  return write;
}

function watchWrites(mesh: CloudMesh) {
  let opacity = mesh.material.opacity;
  const opacityWrite = vi.fn((value: number) => { opacity = value; });
  Object.defineProperty(mesh.material, 'opacity', {
    configurable: true,
    get: () => opacity,
    set: opacityWrite,
  });
  return {
    opacityWrite,
    colorWrite: vi.spyOn(mesh.material.color, 'set'),
    matrixWrite: vi.spyOn(mesh, 'setMatrixAt'),
    matrixVersion: mesh.instanceMatrix.version,
  };
}

beforeEach(() => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#152325');
  scene.fog = new THREE.Fog('#243234', 20, 90);
  camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
  camera.layers.enable(1);
  frameCallback = null;
  gpu.tier = 'high';
  gpu.softwareRenderer = false;
  contact.mode = 'outside';
  contact.progress = 0;
  contact.revision = 0;
  contact.committed = -1;
  requests = [];
  synchronousLoadError = null;
  frameGate.mockReset().mockReturnValue(true);
  gpuReading.mockClear();
  gl.initTexture.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(function (
    this: THREE.TextureLoader, url, onLoad, _onProgress, onError,
  ) {
    const texture = new THREE.Texture();
    vi.spyOn(texture, 'dispose');
    const request: TextureRequest = {
      url, manager: this.manager, texture,
      resolve: () => {
        texture.needsUpdate = true;
        onLoad?.(texture);
      },
      reject: error => onError?.(error),
    };
    requests.push(request);
    if (synchronousLoadError) request.reject(synchronousLoadError);
    return texture;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ContactSky geometry and ownership', () => {
  it('uploads each loaded bank while idle, before any flight shows it, and not after unmount', () => {
    // Round 8 trace: the first upload decoded the cloud image inside the flight's first cloudy frame.
    vi.useFakeTimers();
    try {
      const { unmount } = render(<ContactSky isLight />);
      requests[0].resolve();
      depart(0.9);
      requests[1].resolve();
      expect(gl.initTexture).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      expect(gl.initTexture.mock.calls.map(([texture]) => texture)).toEqual(cloudMeshes().map(mesh => mesh.material.map));
      unmount();

      gl.initTexture.mockClear();
      requests = [];
      render(<ContactSky isLight />);
      loadTextures();
      cleanup();
      vi.advanceTimersByTime(300);
      expect(gl.initTexture).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses five quads, two materials and one shared two-triangle geometry', () => {
    render(<ContactSky isLight={false} />);
    const meshes = cloudMeshes();
    expect(meshes).toHaveLength(2);
    expect(meshes.reduce((count, mesh) => count + mesh.count, 0)).toBe(5);
    expect(new Set(meshes.map(mesh => mesh.material)).size).toBe(2);
    expect(new Set(meshes.map(mesh => mesh.geometry)).size).toBe(1);
    expect(meshes[0].geometry.getAttribute('position').count).toBe(4);
    expect(meshes[0].geometry.index?.count).toBe(6);
    expect(gpuReading).toHaveBeenCalledTimes(1);
    for (const mesh of meshes) {
      expect(mesh.material.transparent).toBe(true);
      expect(mesh.material.depthTest).toBe(true);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.blending).toBe(THREE.NormalBlending);
      expect(mesh.material.fog).toBe(true);
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
      expect(mesh.boundingSphere?.radius).toBeGreaterThan(0);
      expect(mesh.layers.mask).toBe(1 << CONTACT_CLOUD_LAYER);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.matrixWorldAutoUpdate).toBe(false);
    }
  });

  it.each([
    { tier: 'low', softwareRenderer: false },
    { tier: 'high', softwareRenderer: true },
  ] as const)('uses a single two-quad batch on $tier / software=$softwareRenderer', config => {
    Object.assign(gpu, config);
    render(<ContactSky isLight={false} />);
    expect(cloudMeshes()).toHaveLength(1);
    expect(cloudMeshes()[0].count).toBe(2);
    expect(requests.map(request => request.url)).toEqual(['/textures/hero-cloud/body.webp']);
  });

  it('copies the clearing pose and fixes every plane to it without mutating the exports', () => {
    const position = CONTACT_SKY_POSITION.clone();
    const orientation = CONTACT_SKY_ORIENTATION.clone();
    const { unmount } = render(<ContactSky isLight={false} />);
    const root = cloudRoot();
    expect(root.position.equals(position)).toBe(true);
    expect(root.quaternion.equals(orientation)).toBe(true);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(root.matrixWorldAutoUpdate).toBe(false);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
    for (const mesh of cloudMeshes()) {
      for (let index = 0; index < mesh.count; index++) {
        const instance = new THREE.Matrix4();
        mesh.getMatrixAt(index, instance);
        const world = mesh.matrixWorld.clone().multiply(instance);
        const local = new THREE.Vector3().setFromMatrixPosition(world)
          .sub(position).applyQuaternion(orientation.clone().invert());
        expect(-local.z).toBeGreaterThanOrEqual(20);
        expect(-local.z).toBeLessThanOrEqual(45);
        expect(new THREE.Vector3(0, 0, 1).transformDirection(world).dot(normal))
          .toBeCloseTo(1, 6);
      }
    }
    unmount();
    expect(CONTACT_SKY_POSITION.equals(position)).toBe(true);
    expect(CONTACT_SKY_ORIENTATION.equals(orientation)).toBe(true);
  });

  it.each([false, true])('restores only its camera bit when previously enabled=%s', enabled => {
    if (enabled) camera.layers.enable(CONTACT_CLOUD_LAYER);
    const { unmount } = render(<ContactSky isLight={false} />);
    expect(camera.layers.isEnabled(0)).toBe(true);
    expect(camera.layers.isEnabled(1)).toBe(true);
    expect(camera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(true);
    camera.layers.disable(1);
    camera.layers.enable(5);
    const mirror = new THREE.PerspectiveCamera();
    for (const mesh of cloudMeshes()) expect(mirror.layers.test(mesh.layers)).toBe(false);
    unmount();
    expect(camera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(enabled);
    expect(camera.layers.isEnabled(0)).toBe(true);
    expect(camera.layers.isEnabled(1)).toBe(false);
    expect(camera.layers.isEnabled(5)).toBe(true);
  });

  it('transfers the owned bit when the default camera changes without rebuilding banks', () => {
    const { rerender, unmount } = render(<ContactSky isLight={false} />);
    const previousCamera = camera;
    const root = cloudRoot();
    camera = new THREE.PerspectiveCamera();
    camera.layers.enable(6);
    rerender(<ContactSky isLight={false} />);
    expect(previousCamera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(false);
    expect(previousCamera.layers.isEnabled(1)).toBe(true);
    expect(camera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(true);
    expect(cloudRoot()).toBe(root);
    expect(requests).toHaveLength(2);
    unmount();
    expect(camera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(false);
    expect(camera.layers.isEnabled(6)).toBe(true);
  });
});

describe('ContactSky frame gating', () => {
  it('does no material or instance writes while outside or before the shared reveal', () => {
    render(<ContactSky isLight={false} />);
    const meshes = cloudMeshes();
    const writes = meshes.map(watchWrites);
    const visibilityWrites = [cloudRoot(), ...meshes].map(watchVisibility);
    loadTextures();
    for (let index = 0; index < 40; index++) frame(index);
    contact.mode = 'departing';
    contact.progress = 0.2;
    frame(41);
    expect(cloudRoot().visible).toBe(false);
    expect(frameGate).not.toHaveBeenCalled();
    for (const write of visibilityWrites) expect(write).not.toHaveBeenCalled();
    writes.forEach((write, index) => {
      expect(write.opacityWrite).not.toHaveBeenCalled();
      expect(write.colorWrite).not.toHaveBeenCalled();
      expect(write.matrixWrite).not.toHaveBeenCalled();
      expect(meshes[index].instanceMatrix.version).toBe(write.matrixVersion);
    });
    expect(requests).toHaveLength(2);
  });

  it('skips denied frames and performs no repeat writes at a static sky endpoint', () => {
    render(<ContactSky isLight={false} />);
    const meshes = cloudMeshes();
    const writes = meshes.map(watchWrites);
    loadTextures();
    park();
    frameGate.mockReturnValue(false);
    frame();
    expect(cloudRoot().visible).toBe(false);
    for (const write of writes) {
      expect(write.opacityWrite).not.toHaveBeenCalled();
      expect(write.colorWrite).not.toHaveBeenCalled();
    }
    frameGate.mockReturnValue(true);
    frame(2);
    expect(cloudRoot().visible).toBe(true);
    const visibilityWrites = [cloudRoot(), ...meshes].map(watchVisibility);
    for (const write of writes) {
      expect(write.opacityWrite).toHaveBeenCalledTimes(1);
      expect(write.colorWrite).toHaveBeenCalledTimes(1);
      write.opacityWrite.mockClear();
      write.colorWrite.mockClear();
    }
    for (let index = 3; index < 50; index++) frame(index);
    for (const write of visibilityWrites) expect(write).not.toHaveBeenCalled();
    writes.forEach((write, index) => {
      expect(write.opacityWrite).not.toHaveBeenCalled();
      expect(write.colorWrite).not.toHaveBeenCalled();
      expect(write.matrixWrite).not.toHaveBeenCalled();
      expect(meshes[index].instanceMatrix.version).toBe(write.matrixVersion);
    });
  });

  it('mirrors the shared progress on return and hides without offscreen material writes', () => {
    render(<ContactSky isLight={false} />);
    loadTextures();
    const body = cloudMeshes()[0];
    contact.mode = 'departing';
    contact.progress = 0.57;
    frame();
    const departureOpacity = body.material.opacity;
    expect(departureOpacity).toBeCloseTo(getContactCloudOpacity('departing', 0.57) * 0.34);
    const write = watchWrites(body);
    contact.mode = 'returning';
    frame(2);
    expect(body.material.opacity).toBe(departureOpacity);
    expect(write.opacityWrite).not.toHaveBeenCalled();
    contact.progress = 0.4;
    frame(3);
    expect(body.material.opacity).toBeLessThan(departureOpacity);
    write.opacityWrite.mockClear();
    contact.progress = 0;
    frameGate.mockReturnValue(false);
    frame(4);
    expect(cloudRoot().visible).toBe(true);
    frameGate.mockReturnValue(true);
    frame(5);
    expect(cloudRoot().visible).toBe(false);
    expect(write.opacityWrite).not.toHaveBeenCalled();
    contact.mode = 'outside';
    contact.progress = 1;
    frame(6);
    expect(cloudRoot().visible).toBe(false);
    expect(write.matrixWrite).not.toHaveBeenCalled();
  });

  it('defers theme writes until a drawn Contact frame and never owns scene grading', () => {
    const background = scene.background;
    const fog = scene.fog;
    const fogColor = (fog as THREE.Fog).color.clone();
    const { rerender } = render(<ContactSky isLight={false} />);
    loadTextures();
    park();
    frame();
    const body = cloudMeshes()[0];
    expect(body.material.color.getHexString()).toBe('b7c7ca');
    const write = watchWrites(body);
    frameGate.mockReturnValue(false);
    rerender(<ContactSky isLight />);
    frame(2);
    expect(write.colorWrite).not.toHaveBeenCalled();
    frameGate.mockReturnValue(true);
    frame(3);
    expect(body.material.color.getHexString()).toBe('bfced9');
    expect(body.material.opacity).toBe(0.52);
    expect(body.material.toneMapped).toBe(false);
    const lightVersion = body.material.version;
    write.colorWrite.mockClear();
    write.opacityWrite.mockClear();
    contact.mode = 'outside';
    rerender(<ContactSky isLight={false} />);
    frame(4);
    frame(5);
    expect(write.colorWrite).not.toHaveBeenCalled();
    expect(write.opacityWrite).not.toHaveBeenCalled();
    expect(body.material.version).toBe(lightVersion);
    park();
    frame(6);
    expect(body.material.color.getHexString()).toBe('b7c7ca');
    expect(body.material.toneMapped).toBe(true);
    expect(scene.background).toBe(background);
    expect(scene.fog).toBe(fog);
    expect((scene.fog as THREE.Fog).color.equals(fogColor)).toBe(true);
    expect(requests).toHaveLength(2);
  });
});

describe('ContactSky optional texture lifetime', () => {
  it('never suspends semantic content or enlists the global loading manager', () => {
    depart();
    const { getByText } = render(<><ContactSky isLight /><p>Contact remains usable</p></>);
    expect(getByText('Contact remains usable')).toBeVisible();
    expect(requests.map(request => request.url)).toEqual([
      '/textures/hero-cloud/body.webp', '/textures/hero-cloud/vapor.webp',
    ]);
    expect(requests[0].manager).not.toBe(THREE.DefaultLoadingManager);
    expect(requests[1].manager).toBe(requests[0].manager);
    expect(requests[0].texture).not.toBe(requests[1].texture);
    frame();
    expect(cloudRoot().visible).toBe(false);
    const error = new Error('Cloud body unavailable');
    requests[0].reject(error);
    requests[1].resolve();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/textures/hero-cloud/body.webp'), error,
    );
    expect(requests[0].texture.dispose).toHaveBeenCalledTimes(1);
    contact.progress = 0.57;
    frame(2);
    expect(cloudMeshes()[0].visible).toBe(false);
    expect(cloudMeshes()[1].visible).toBe(true);
    expect(getByText('Contact remains usable')).toBeVisible();
    expect(requests[1].texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('draws nothing when both optional images fail', () => {
    const { unmount } = render(<ContactSky isLight={false} />);
    park();
    for (const request of requests) request.reject(new Error('Unavailable'));
    frame();
    expect(cloudRoot().visible).toBe(false);
    expect(cloudMeshes().every(mesh => !mesh.visible)).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(2);
    unmount();
    for (const request of requests) expect(request.texture.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases synchronous failures exactly once, including ownership returned after onError', () => {
    synchronousLoadError = new Error('Synchronous image failure');
    const { getByText, unmount } = render(
      <><ContactSky isLight={false} /><p>Contact remains usable</p></>,
    );
    expect(getByText('Contact remains usable')).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
    for (const request of requests) {
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(request.url), synchronousLoadError,
      );
      expect(request.texture.dispose).toHaveBeenCalledTimes(1);
      request.reject(new Error('Duplicate failure'));
    }
    park();
    frame();
    expect(cloudRoot().visible).toBe(false);
    for (const mesh of cloudMeshes()) expect(mesh.material.map).toBeNull();
    unmount();
    for (const request of requests) expect(request.texture.dispose).toHaveBeenCalledTimes(1);
    requests[0].resolve();
    expect(requests[0].texture.dispose).toHaveBeenCalledTimes(2);
    expect(requests[1].texture.dispose).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(scene.getObjectByName('Contact sky')).toBeUndefined();
  });

  it('admits pre-reveal completion but waits for a drawn frame before painting', () => {
    render(<ContactSky isLight={false} />);
    depart();
    requests[0].resolve();
    frame();
    const [body, vapor] = cloudMeshes();
    const write = watchWrites(body);
    requests[1].resolve();
    contact.progress = 0.57;
    frameGate.mockReturnValue(false);
    frame(2);
    expect(body.visible).toBe(false);
    expect(vapor.visible).toBe(false);
    expect(write.opacityWrite).not.toHaveBeenCalled();
    expect(write.colorWrite).not.toHaveBeenCalled();
    frameGate.mockReturnValue(true);
    frame(3);
    expect(body.visible).toBe(true);
    expect(vapor.visible).toBe(true);
    expect(vapor.material.opacity).toBeCloseTo(getContactCloudOpacity('departing', 0.57) * 0.16);
    expect(write.opacityWrite).toHaveBeenCalledTimes(1);
    expect(write.colorWrite).toHaveBeenCalledTimes(1);
    expect(write.matrixWrite).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'parked', progress: 1 },
    { mode: 'departing', progress: 0.9 },
    { mode: 'departing', progress: 0.57 },
    { mode: 'returning', progress: 0.57 },
  ] as const)('defers a bank loaded while $mode at $progress through the next return', view => {
    render(<ContactSky isLight={false} />);
    requests[0].resolve();
    depart(0.57);
    frame();
    contact.mode = view.mode;
    contact.progress = view.progress;
    frame(2);
    const [body, vapor] = cloudMeshes();
    const bodyWrites = watchWrites(body);
    const vaporWrites = watchWrites(vapor);
    const visibilityWrites = [cloudRoot(), body, vapor].map(watchVisibility);
    requests[1].resolve();
    frameGate.mockClear();
    for (let index = 3; index < 40; index++) frame(index);
    expect(body.visible).toBe(true);
    expect(vapor.visible).toBe(false);
    expect(vapor.material.opacity).toBe(0);
    expect(frameGate).not.toHaveBeenCalled();
    for (const write of visibilityWrites) expect(write).not.toHaveBeenCalled();
    expect(bodyWrites.opacityWrite).not.toHaveBeenCalled();
    expect(bodyWrites.colorWrite).not.toHaveBeenCalled();
    expect(vaporWrites.opacityWrite).not.toHaveBeenCalled();
    expect(vaporWrites.colorWrite).not.toHaveBeenCalled();
    expect(requests[1].texture.dispose).not.toHaveBeenCalled();

    contact.mode = 'returning';
    contact.revision++;
    contact.progress = 1;
    frame(40);
    expect(vapor.visible).toBe(false);
    expect(vapor.material.opacity).toBe(0);
    expect(visibilityWrites[2]).not.toHaveBeenCalled();
    expect(vaporWrites.opacityWrite).not.toHaveBeenCalled();
    expect(vaporWrites.colorWrite).not.toHaveBeenCalled();
    contact.progress = 0.57;
    frame(41);
    expect(vapor.visible).toBe(false);
    contact.mode = 'outside';
    contact.progress = 0;
    frame(42);
    depart();
    frame(43);
    expect(contact.progress).toBe(0);
    expect(cloudRoot().visible).toBe(false);
    expect(vaporWrites.opacityWrite).not.toHaveBeenCalled();
    expect(vaporWrites.colorWrite).not.toHaveBeenCalled();
    contact.progress = 0.57;
    frameGate.mockReturnValue(false);
    frame(44);
    expect(vapor.visible).toBe(false);
    frameGate.mockReturnValue(true);
    frame(45);
    expect(vapor.visible).toBe(true);
    expect(vapor.material.opacity).toBeCloseTo(getContactCloudOpacity('departing', 0.57) * 0.16);
    expect(vaporWrites.opacityWrite).toHaveBeenCalledTimes(1);
    expect(vaporWrites.colorWrite).toHaveBeenCalledTimes(1);
    expect(bodyWrites.matrixWrite).not.toHaveBeenCalled();
    expect(vaporWrites.matrixWrite).not.toHaveBeenCalled();
    expect(requests).toHaveLength(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('disposes all owned GPU resources and late texture completion after unmount', () => {
    const { unmount } = render(<ContactSky isLight={false} />);
    const meshes = cloudMeshes();
    const geometryDispose = vi.spyOn(meshes[0].geometry, 'dispose');
    const materialDisposals = meshes.map(mesh => vi.spyOn(mesh.material, 'dispose'));
    const instanceDisposals = meshes.map(mesh => vi.spyOn(mesh, 'dispose'));
    unmount();
    expect(scene.getObjectByName('Contact sky')).toBeUndefined();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    for (const dispose of [...materialDisposals, ...instanceDisposals]) {
      expect(dispose).toHaveBeenCalledTimes(1);
    }
    for (const request of requests) expect(request.texture.dispose).toHaveBeenCalledTimes(1);
    requests[0].resolve();
    requests[1].reject(new Error('Late failure'));
    expect(requests[0].texture.dispose).toHaveBeenCalledTimes(2);
    expect(requests[1].texture.dispose).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
    park();
    frame();
    expect(frameGate).not.toHaveBeenCalled();
  });

  it('keeps StrictMode replay and stale load callbacks isolated from the current scene', () => {
    const { unmount } = render(<StrictMode><ContactSky isLight={false} /></StrictMode>);
    expect(scene.children).toHaveLength(1);
    expect(requests).toHaveLength(4);
    requests[0].resolve();
    requests[1].resolve();
    frame();
    expect(cloudRoot().visible).toBe(false);
    requests[2].resolve();
    requests[3].resolve();
    park();
    frame(2);
    expect(cloudRoot().visible).toBe(true);
    expect(camera.layers.isEnabled(1)).toBe(true);
    unmount();
    expect(scene.children).toHaveLength(0);
    expect(camera.layers.isEnabled(CONTACT_CLOUD_LAYER)).toBe(false);
    expect(camera.layers.isEnabled(1)).toBe(true);
    for (const request of requests) expect(request.texture.dispose).toHaveBeenCalled();
  });
});
