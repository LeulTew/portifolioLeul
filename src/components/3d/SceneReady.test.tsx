import { StrictMode, Suspense } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from 'react-error-boundary';
import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three-stdlib';
import { PerspectiveCamera, Scene, Texture, TextureLoader, WebGLRenderTarget } from 'three';
import { SceneReady } from './SceneReady';
import { isSceneReady, isWorldHeld, resetSceneReady, WORLD_COMPILE_MS } from '@/lib/render/sceneReady';

const frames = vi.hoisted(() => new Set<(state: unknown) => void>());
vi.mock('@react-three/fiber', async importOriginal => {
  const actual = await importOriginal<typeof import('@react-three/fiber')>();
  const { useLayoutEffect } = await import('react');
  return {
    ...actual,
    useFrame: (callback: (state: unknown) => void) => useLayoutEffect(() => {
      frames.add(callback);
      return () => { frames.delete(callback); };
    }, [callback]),
  };
});
vi.mock('@react-three/drei', async () => {
  // Keep the test's CJS/ESM loader constructor identity consistent while
  // exercising the real R3F Suspense cache used by Drei's thin wrapper.
  const { useLoader } = await import('@react-three/fiber');
  const { GLTFLoader } = await import('three-stdlib');
  return {
    useGLTF: Object.assign(
      (url: string | string[]) => useLoader(GLTFLoader, url),
      { clear: (url: string | string[]) => useLoader.clear(GLTFLoader, url) },
    ),
  };
});

const models = ['/models/readiness-terrain.glb', '/models/readiness-avatar.glb'];
const textures = ['/images/readiness-normal.jpg'];
const pendingModels = new Map<string, { resolve: () => void; reject: () => void }[]>();
const pendingTextures: (() => void)[] = [];
const modelDocument = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{}] });

/** A renderer whose programs compile when the test says, recording the target each was asked for under. */
function world() {
  const compiles: { target: unknown; finish: () => void; fail: () => void }[] = [];
  let target: unknown = null;
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => { target = next; },
    info: { programs: [] },
    compileAsync: vi.fn(() => new Promise<void>((resolve, reject) => {
      compiles.push({ target, finish: resolve, fail: () => reject(new Error('context lost')) });
    })),
  };
  const state = { gl, scene: new Scene(), camera: new PerspectiveCamera() };
  const tick = () => act(() => { for (const frame of frames) frame(state); });
  return { gl, state, compiles, tick };
}

/** Mounts a SceneReady whose resources have all arrived, with its frame subscribed. */
async function resourcedScene() {
  render(<Suspense fallback={null}><SceneReady models={[models[0]]} textures={[]} /></Suspense>);
  await act(async () => { for (const entry of pendingModels.get(models[0]) ?? []) entry.resolve(); });
  await waitFor(() => expect(frames.size).toBe(1));
}

function SceneModel({ url }: { url: string }) {
  useGLTF(url, false);
  return null;
}

function SceneTexture({ url }: { url: string }) {
  useLoader(TextureLoader, url);
  return null;
}

beforeEach(() => {
  resetSceneReady();
  frames.clear();
  pendingModels.clear();
  pendingTextures.length = 0;
  vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function (this: GLTFLoader, url, onLoad, _onProgress, onError) {
    const entries = pendingModels.get(url) ?? [];
    entries.push({
      resolve: () => this.parse(modelDocument, '', onLoad, onError),
      reject: () => onError?.(new ErrorEvent('error', { message: 'model unavailable' })),
    });
    pendingModels.set(url, entries);
  });
  vi.spyOn(TextureLoader.prototype, 'load').mockImplementation((_url, onLoad) => {
    const texture = new Texture();
    pendingTextures.push(() => onLoad?.(texture));
    return texture;
  });
});

afterEach(() => {
  cleanup();
  for (const url of models) useGLTF.clear(url);
  useGLTF.clear(models);
  for (const url of textures) useLoader.clear(TextureLoader, url);
  useLoader.clear(TextureLoader, textures);
  resetSceneReady();
  vi.restoreAllMocks();
});

describe('scene readiness uses the mounted scene resource keys', () => {
  it('shares both parsed GLTFs and the texture with visible consumers, including StrictMode', async () => {
    const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
    const view = render(<StrictMode>
      <Suspense fallback={<span>Waiting for world</span>}>
        <SceneReady models={models} textures={textures} />
      </Suspense>
      {models.map(url => <Suspense key={url} fallback={null}><SceneModel url={url} /></Suspense>)}
      <Suspense fallback={null}><SceneTexture url={textures[0]} /></Suspense>
    </StrictMode>);
    expect(isSceneReady()).toBe(false);
    expect(frames.size).toBe(0);
    expect(GLTFLoader.prototype.load).toHaveBeenCalledTimes(2);
    expect(TextureLoader.prototype.load).toHaveBeenCalledOnce();
    await act(async () => {
      for (const entry of pendingModels.get(models[0]) ?? []) entry.resolve();
    });
    expect(isSceneReady()).toBe(false);
    expect(frames.size).toBe(0);
    await act(async () => {
      for (const entry of pendingModels.get(models[1]) ?? []) entry.resolve();
    });
    expect(frames.size).toBe(0);
    await act(async () => { for (const resolve of pendingTextures) resolve(); });
    await waitFor(() => expect(frames.size).toBe(1));
    expect(parse).toHaveBeenCalledTimes(2);
    expect(isSceneReady()).toBe(false);
    const { compiles, tick } = world();
    tick();
    expect(isSceneReady()).toBe(false);
    for (let pass = 0; pass < 2; pass++) await act(async () => { compiles[pass].finish(); });
    tick();
    expect(isSceneReady()).toBe(true);
    view.unmount();
    expect(frames.size).toBe(0);
  });

  it('leaves ordinary model failures visible to the scene error boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary fallback={<span>Scene unavailable</span>}>
      <Suspense fallback={<span>Waiting for world</span>}>
        <SceneReady models={models} textures={[]} />
      </Suspense>
    </ErrorBoundary>);
    await act(async () => { for (const entry of pendingModels.get(models[0]) ?? []) entry.reject(); });
    expect(await screen.findByText('Scene unavailable')).toBeVisible();
    expect(isSceneReady()).toBe(false);
    expect(frames.size).toBe(0);
  });

  it('does not delay or register a world for an ordinary non-WebGL page', () => {
    render(<main>Flat portfolio</main>);
    expect(isSceneReady()).toBe(true);
    expect(GLTFLoader.prototype.load).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});

describe('the opening programs compile before the world is drawn (round 31)', () => {
  it('holds the world undrawn and the loader shut until the canvas and a render target have both compiled', async () => {
    await resourcedScene();
    expect(isWorldHeld()).toBe(true);
    const { gl, compiles, tick } = world();
    tick();
    tick();
    expect(gl.compileAsync).toHaveBeenCalledOnce();
    expect(compiles[0].target).toBeNull();
    await act(async () => { compiles[0].finish(); });
    // The water draws the scene into a target: linear and untoned, so programs of its own.
    expect(compiles[1].target).toBeInstanceOf(WebGLRenderTarget);
    expect(gl.getRenderTarget()).toBeNull();
    tick();
    expect(isWorldHeld()).toBe(true);
    expect(isSceneReady()).toBe(false);
    await act(async () => { compiles[1].finish(); });
    expect(isWorldHeld()).toBe(false);
    expect(isSceneReady()).toBe(false);
    tick();
    expect(isSceneReady()).toBe(true);
    expect(gl.compileAsync).toHaveBeenCalledTimes(2);
  });

  it('draws and opens anyway once compiling has taken its allowance', async () => {
    await resourcedScene();
    const { compiles, tick } = world();
    const start = performance.now();
    tick();
    vi.spyOn(performance, 'now').mockReturnValue(start + WORLD_COMPILE_MS + 1);
    tick();
    expect(isWorldHeld()).toBe(false);
    expect(isSceneReady()).toBe(true);
    await act(async () => { compiles[0].finish(); });
  });

  it('draws and opens when compiling fails, rather than waiting on it', async () => {
    await resourcedScene();
    const { compiles, tick } = world();
    tick();
    await act(async () => { compiles[0].fail(); });
    expect(isWorldHeld()).toBe(false);
    tick();
    expect(isSceneReady()).toBe(true);
  });

  it('never holds a world that was already up when its scene mounts again', async () => {
    // A remounted scene -- the Canvas rebuilt after a lost context, say -- recompiles as it draws;
    // the reader is already on the page, so nothing waits for it.
    await resourcedScene();
    const first = world();
    first.tick();
    for (let pass = 0; pass < 2; pass++) await act(async () => { first.compiles[pass].finish(); });
    first.tick();
    expect(isSceneReady()).toBe(true);
    cleanup();
    frames.clear();
    render(<Suspense fallback={null}><SceneReady models={[models[0]]} textures={[]} /></Suspense>);
    await waitFor(() => expect(frames.size).toBe(1));
    expect(isWorldHeld()).toBe(false);
    const second = world();
    second.tick();
    expect(isWorldHeld()).toBe(false);
    expect(isSceneReady()).toBe(true);
  });
});
