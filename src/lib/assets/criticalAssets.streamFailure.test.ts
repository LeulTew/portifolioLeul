import { createServer, type Server, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cache, FileLoader, LoadingManager } from 'three';
import { GLTFLoader } from 'three-stdlib';
import {
  createCriticalAssetRun, loadCriticalAssets, MODEL_PREFETCH_TIMEOUT_MS, type CriticalAsset,
} from './criticalAssets';

const servers: Server[] = [];
const urls: string[] = [];
const nativeFetch = globalThis.fetch;
const commonJS: typeof import('three') = createRequire(import.meta.url)('three');

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

async function modelServer(first: (response: ServerResponse, bytes: Uint8Array) => void) {
  const bytes = modelBytes();
  const paths: (string | undefined)[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url);
    if (paths.length === 1) first(response, bytes);
    else {
      response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.byteLength });
      response.end(bytes);
    }
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected the owned fixture HTTP port');
  const url = `http://127.0.0.1:${address.port}/streamed.glb`;
  urls.push(url);
  const asset: CriticalAsset = { url, bytes: bytes.byteLength, kind: 'model' };
  return { asset, paths };
}

afterEach(async () => {
  vi.useRealTimers();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  for (const url of urls.splice(0)) Cache.remove(url);
  vi.restoreAllMocks();
});

describe('native prefetch failure does not wedge Three loader retries', () => {
  it.each(['body-error', 'abort'] as const)(
    'settles a real HTTP-200 midstream %s and allows the ordinary GLTF loader to retry', async mode => {
      let firstResponse: ServerResponse | undefined;
      const { asset, paths } = await modelServer((response, bytes) => {
        firstResponse = response;
        response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.byteLength });
        response.flushHeaders();
        response.write(bytes.subarray(0, 16));
      });
      const controller = new AbortController();
      const fileLoad = vi.spyOn(FileLoader.prototype, 'load');
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let receivedBeforeFailure = 0;
      const run = createCriticalAssetRun({ assets: [asset], signal: controller.signal });
      let pending: unknown;
      try { run.readModel(asset.url); } catch (value) { pending = value; }
      expect(pending).toBeInstanceOf(Promise);
      run.subscribers.add(progress => {
        if (receivedBeforeFailure || progress.settled || progress.loadedBytes === 0) return;
        receivedBeforeFailure = progress.loadedBytes;
        if (mode === 'body-error') firstResponse?.destroy();
        else controller.abort();
      });
      const result = await run.promise;
      await pending;

      expect(firstResponse?.statusCode).toBe(200);
      expect(receivedBeforeFailure).toBe(16);
      expect(result).toMatchObject({ ratio: 1, settled: 1, failed: 1 });
      expect(Cache.get(asset.url)).toBeUndefined();
      expect(fileLoad).not.toHaveBeenCalled();
      expect(() => run.readModel(asset.url)).not.toThrow();
      if (mode === 'body-error') expect(warning).toHaveBeenCalledWith(
        expect.stringContaining(asset.url), expect.objectContaining({ name: 'TypeError' }),
      );

      const retried = await new GLTFLoader().loadAsync(asset.url);
      expect(retried.scene).toBeDefined();
      expect(paths).toEqual(['/streamed.glb', '/streamed.glb']);
      expect(globalThis.fetch).toBe(nativeFetch);
    },
  );

  it('cancels a genuinely stalled native body and releases the model gate before normal retry', async () => {
    const { asset, paths } = await modelServer((response, bytes) => {
      response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.byteLength });
      response.flushHeaders();
      response.write(bytes.subarray(0, 16));
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fileLoad = vi.spyOn(FileLoader.prototype, 'load');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const run = createCriticalAssetRun({ assets: [asset] });
    await new Promise<void>(resolve => {
      run.subscribers.add(progress => { if (progress.loadedBytes === 16) resolve(); });
    });
    let pending: unknown;
    try { run.readModel(asset.url); } catch (value) { pending = value; }
    expect(pending).toBeInstanceOf(Promise);
    await vi.advanceTimersByTimeAsync(MODEL_PREFETCH_TIMEOUT_MS);
    const result = await run.promise;
    await pending;
    vi.useRealTimers();
    expect(result).toMatchObject({ failed: 1, settled: 1, ratio: 1 });
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining(asset.url), expect.objectContaining({ name: 'TimeoutError' }),
    );
    expect(Cache.get(asset.url)).toBeUndefined();
    expect(fileLoad).not.toHaveBeenCalled();
    expect(() => run.readModel(asset.url)).not.toThrow();
    expect((await new GLTFLoader().loadAsync(asset.url)).scene).toBeDefined();
    expect(paths).toHaveLength(2);
    expect(globalThis.fetch).toBe(nativeFetch);
  });

  it.each(['html', 'http-error'] as const)('also permits a real retry after an %s response', async failure => {
    const { asset, paths } = await modelServer(response => {
      response.writeHead(failure === 'html' ? 200 : 503, { 'Content-Type': 'text/html' });
      response.end('<!doctype html>');
    });
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await loadCriticalAssets(() => {}, { assets: [asset] });
    expect(result.failed).toBe(1);
    expect(warning).toHaveBeenCalledOnce();
    expect(Cache.get(asset.url)).toBeUndefined();
    expect((await new GLTFLoader().loadAsync(asset.url)).scene).toBeDefined();
    expect(paths).toHaveLength(2);
    expect(globalThis.fetch).toBe(nativeFetch);
  });

  it.each([
    ['ES module', FileLoader],
    ['CommonJS', commonJS.FileLoader],
  ] as const)('settles every %s FileLoader subscriber after a body failure and retries the same URL', async (_format, Loader) => {
    let firstResponse: ServerResponse | undefined;
    const { asset, paths } = await modelServer((response, bytes) => {
      firstResponse = response;
      response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': bytes.byteLength });
      response.flushHeaders();
      response.write(bytes.subarray(0, 16));
    });
    const failed = vi.fn();
    const manager = new LoadingManager(undefined, undefined, failed);
    const loader = new Loader(manager).setResponseType('arraybuffer');
    const progress = vi.fn(() => firstResponse?.destroy());
    const outcomes = await Promise.allSettled([
      loader.loadAsync(asset.url, progress),
      loader.loadAsync(asset.url),
    ]);
    expect(progress).toHaveBeenCalled();
    expect(outcomes.map(outcome => outcome.status)).toEqual(['rejected', 'rejected']);
    expect(failed).toHaveBeenCalledExactlyOnceWith(asset.url);
    expect(paths).toHaveLength(1);
    const retried = await loader.loadAsync(asset.url);
    if (typeof retried === 'string') throw new Error('The model retry must return binary data');
    expect(new Uint8Array(retried)).toEqual(modelBytes());
    expect(paths).toHaveLength(2);
    expect(globalThis.fetch).toBe(nativeFetch);
  });
});
