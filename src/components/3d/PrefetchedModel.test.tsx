import { createServer, type Server, type ServerResponse } from 'node:http';
import { StrictMode, Suspense, useLayoutEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from 'react-error-boundary';
import { Cache } from 'three';
import { GLTFLoader } from 'three-stdlib';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { createCriticalAssetRun, type CriticalAsset } from '@/lib/assets/criticalAssets';
import { isSceneReady, resetSceneReady } from '@/lib/render/sceneReady';
import { PrefetchedModel } from './PrefetchedModel';
import { SceneReady } from './SceneReady';

let activeRun: ReturnType<typeof createCriticalAssetRun>;
const frames = vi.hoisted(() => new Set<() => void>());
vi.mock('@/lib/assets/criticalAssets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/assets/criticalAssets')>();
  return {
    ...actual,
    readCriticalModel: (url: string) => activeRun.readModel(url),
    markCriticalModelReady: (url: string) => activeRun.modelReady(url),
  };
});
vi.mock('@react-three/fiber', async importOriginal => {
  const actual = await importOriginal<typeof import('@react-three/fiber')>();
  const { useLayoutEffect } = await import('react');
  return {
    ...actual,
    useFrame: (callback: () => void) => useLayoutEffect(() => {
      frames.add(callback);
      return () => { frames.delete(callback); };
    }, [callback]),
  };
});
vi.mock('@react-three/drei', async () => {
  const { useLoader } = await import('@react-three/fiber');
  const { GLTFLoader } = await import('three-stdlib');
  return {
    useGLTF: Object.assign(
      (url: string | string[]) => useLoader(GLTFLoader, url),
      { clear: (url: string | string[]) => useLoader.clear(GLTFLoader, url) },
    ),
  };
});

const servers: Server[] = [];
const urls: string[] = [];
const nativeFetch = globalThis.fetch;

function modelBytes(): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{}] }));
  const length = Math.ceil(json.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + length);
  bytes.fill(32, 20);
  bytes.set(json, 20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, length, true);
  view.setUint32(16, 0x4e4f534a, true);
  return bytes;
}

async function fixture({ held = true, firstFailure = false, persistentFailure = false, media = false } = {}) {
  const bytes = modelBytes();
  const requests: { path: string; status: number; bytes: number; cacheControl?: string }[] = [];
  const pending = new Map<string, (() => void)[]>();
  const server = createServer((request, response: ServerResponse) => {
    const path = request.url ?? '';
    const seen = requests.some(item => item.path === path);
    const fail = persistentFailure || (firstFailure && !seen);
    const record = { path, status: fail ? 503 : 200, bytes: 0, cacheControl: request.headers['cache-control'] };
    requests.push(record);
    response.writeHead(record.status, {
      'Content-Type': path.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream',
      'Content-Length': bytes.byteLength,
      'Cache-Control': 'no-store',
    });
    const send = () => { record.bytes = bytes.byteLength; response.end(bytes); };
    if (held && !fail) pending.set(path, [...(pending.get(path) ?? []), send]);
    else send();
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an owned fixture port');
  const origin = `http://127.0.0.1:${address.port}`;
  const models = [`${origin}/terrain.glb`, `${origin}/avatar.glb`];
  urls.push(...models);
  const assets: CriticalAsset[] = models.map(url => ({ url, bytes: bytes.byteLength, kind: 'model' }));
  if (media) assets.push({ url: `${origin}/portrait.bin`, bytes: bytes.byteLength, kind: 'media' });
  return {
    models, assets, bytes, requests,
    release(path?: string) {
      for (const [name, senders] of pending) {
        if (path && name !== path) continue;
        pending.delete(name);
        for (const send of senders) send();
      }
    },
  };
}

function VisibleModel({ url }: { url: string }) {
  const model = useGLTF(url, false);
  return <span data-testid={url}>{model.scene.type}</span>;
}

function EarlyShell({ mounted, tick }: { mounted: () => void; tick: () => void }) {
  useLayoutEffect(mounted, [mounted]);
  useFrame(tick);
  return <main><h1>Hero layout</h1><input aria-label="Native control" defaultValue="Draft" /></main>;
}

function World({ models }: { models: string[] }) {
  return <>
    <Suspense fallback={<span>Waiting for world</span>}><SceneReady models={models} textures={[]} /></Suspense>
    {models.map(url => <Suspense key={url} fallback={null}>
      <PrefetchedModel url={url}><VisibleModel url={url} /></PrefetchedModel>
    </Suspense>)}
  </>;
}

beforeEach(() => { resetSceneReady(); frames.clear(); });
afterEach(async () => {
  cleanup();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  for (const url of urls.splice(0)) {
    Cache.remove(url);
    useGLTF.clear(url);
  }
  resetSceneReady();
  vi.restoreAllMocks();
});

describe('native prefetch gates only model consumers', () => {
  it('reproduces duplicate transfers when ordinary consumers do not wait for native prefetch', async () => {
    const source = await fixture();
    activeRun = createCriticalAssetRun({ assets: source.assets });
    const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
    render(<>
      {source.models.map(url => <Suspense key={url} fallback={null}><VisibleModel url={url} /></Suspense>)}
    </>);
    await waitFor(() => expect(source.requests).toHaveLength(4));
    await act(async () => { source.release(); await activeRun.promise; });
    for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
    expect(parse).toHaveBeenCalledTimes(2);
    expect(source.requests.reduce((sum, request) => sum + request.bytes, 0)).toBe(source.bytes.byteLength * 4);
    console.info('MODEL_GATE_CONTROL', JSON.stringify({
      requests: source.requests.length, bytes: source.requests.reduce((sum, request) => sum + request.bytes, 0),
      glbBytes: source.bytes.byteLength, parses: parse.mock.calls.length, gated: false,
      nativeFetchUnchanged: globalThis.fetch === nativeFetch,
    }));
  });

  it.each(['default', 'no-store'] as const)(
    'transfers and parses each GLB once with %s requests, including StrictMode and remount', async cache => {
      const source = await fixture();
      const transport: typeof fetch = (input, init) => nativeFetch(input, { ...init, cache });
      activeRun = createCriticalAssetRun({ assets: source.assets, fetchImpl: transport });
      const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
      const mounted = vi.fn();
      const tick = vi.fn();
      const view = render(<StrictMode>
        <EarlyShell mounted={mounted} tick={tick} />
        <World models={source.models} />
      </StrictMode>);
      expect(screen.getByRole('heading', { name: 'Hero layout' })).toBeVisible();
      expect(screen.getByLabelText('Native control')).toHaveValue('Draft');
      expect(mounted).toHaveBeenCalled();
      expect(isSceneReady()).toBe(false);
      expect(parse).not.toHaveBeenCalled();
      act(() => { for (const frame of frames) frame(); });
      expect(tick).toHaveBeenCalledOnce();
      expect(isSceneReady()).toBe(false);
      await waitFor(() => expect(source.requests).toHaveLength(2));

      // A single completed GLB is usable even while the other is downloading.
      await act(async () => { source.release('/avatar.glb'); });
      expect(await screen.findByTestId(source.models[1])).toBeVisible();
      expect(screen.queryByTestId(source.models[0])).toBeNull();
      expect(parse).toHaveBeenCalledOnce();
      expect(isSceneReady()).toBe(false);
      await act(async () => { source.release('/terrain.glb'); await activeRun.promise; });
      expect(await screen.findByTestId(source.models[0])).toBeVisible();
      await waitFor(() => expect(frames.size).toBe(2));
      expect(parse).toHaveBeenCalledTimes(2);
      act(() => { for (const frame of frames) frame(); });
      expect(isSceneReady()).toBe(true);
      activeRun.releaseModels(source.assets);
      for (const url of source.models) expect(Cache.get(url)).toBeUndefined();
      view.unmount();
      render(<StrictMode><World models={source.models} /></StrictMode>);
      for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
      expect(source.requests).toHaveLength(2);
      expect(source.requests.reduce((total, request) => total + request.bytes, 0)).toBe(source.bytes.byteLength * 2);
      expect(parse).toHaveBeenCalledTimes(2);
      expect(globalThis.fetch).toBe(nativeFetch);
      console.info('MODEL_GATE_PROOF', JSON.stringify({
        cache, requests: source.requests.length, bytes: source.requests.reduce((sum, request) => sum + request.bytes, 0),
        glbBytes: source.bytes.byteLength, parses: parse.mock.calls.length, strictMode: true, remount: true,
        nativeFetchUnchanged: globalThis.fetch === nativeFetch,
      }));
    },
  );

  it.each(['while-downloading', 'after-prefetch'] as const)(
    'defers an early raw-cache release %s until a parsed consumer commits', async when => {
      const source = await fixture();
      activeRun = createCriticalAssetRun({ assets: source.assets });
      await waitFor(() => expect(source.requests).toHaveLength(2));
      if (when === 'while-downloading') activeRun.releaseModels(source.assets);
      source.release();
      await activeRun.promise;
      if (when === 'after-prefetch') activeRun.releaseModels(source.assets);
      for (const url of source.models) expect(Cache.get(url)).toBeInstanceOf(ArrayBuffer);
      const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
      render(<World models={source.models} />);
      for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
      await waitFor(() => {
        for (const url of source.models) expect(Cache.get(url)).toBeUndefined();
      });
      expect(source.requests).toHaveLength(2);
      expect(parse).toHaveBeenCalledTimes(2);
    },
  );

  it('keeps an abandoned suspended render from cancelling the next model consumer', async () => {
    const source = await fixture();
    activeRun = createCriticalAssetRun({ assets: source.assets });
    const view = render(<StrictMode><World models={source.models} /></StrictMode>);
    await waitFor(() => expect(source.requests).toHaveLength(2));
    view.unmount();
    await act(async () => { source.release(); await activeRun.promise; });
    render(<World models={source.models} />);
    for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
    expect(source.requests).toHaveLength(2);
  });

  it('does not wait for unrelated portrait bytes to release a model', async () => {
    const source = await fixture({ media: true });
    activeRun = createCriticalAssetRun({ assets: source.assets });
    render(<World models={source.models} />);
    await waitFor(() => expect(source.requests).toHaveLength(3));
    await act(async () => {
      source.release('/terrain.glb');
      source.release('/avatar.glb');
    });
    for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
    expect(activeRun.latest.settled).toBe(2);
    source.release('/portrait.bin');
    await activeRun.promise;
  });

  it('releases failed native prefetches into real ordinary GLTF retries', async () => {
    const source = await fixture({ held: false, firstFailure: true });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    activeRun = createCriticalAssetRun({ assets: source.assets });
    const parse = vi.spyOn(GLTFLoader.prototype, 'parse');
    render(<World models={source.models} />);
    for (const url of source.models) expect(await screen.findByTestId(url)).toBeVisible();
    expect((await activeRun.promise).failed).toBe(2);
    expect(warning).toHaveBeenCalledTimes(2);
    expect(source.requests).toHaveLength(4);
    expect(source.requests.map(request => request.status).sort()).toEqual([200, 200, 503, 503]);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failed ordinary retry to the existing error boundary', async () => {
    const source = await fixture({ held: false, persistentFailure: true });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    activeRun = createCriticalAssetRun({ assets: source.assets });
    render(<ErrorBoundary fallback={<span>Flat fallback</span>}>
      <World models={source.models} />
    </ErrorBoundary>);
    expect(await screen.findByText('Flat fallback')).toBeVisible();
    expect((await activeRun.promise).failed).toBe(2);
    expect(isSceneReady()).toBe(false);
  });
});
