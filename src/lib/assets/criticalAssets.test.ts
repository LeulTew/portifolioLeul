import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  CRITICAL_ASSETS,
  loadCriticalAssets,
  releaseCriticalAssets,
  resetCriticalAssets,
  type CriticalAsset,
} from './criticalAssets';

const assets: CriticalAsset[] = [
  { url: '/models/big.glb', bytes: 800, kind: 'model' },
  { url: '/images/small.png', bytes: 200, kind: 'texture' },
];

/** A chunk that opens with the binary glTF magic, as a real model does. */
function glbChunk(size: number): Uint8Array {
  const bytes = new Uint8Array(Math.max(size, 4));
  // 'glTF', little endian.
  bytes.set([0x67, 0x6c, 0x54, 0x46], 0);
  return bytes;
}

/** A response whose body arrives in `chunks`, one read at a time. */
function streamed(chunks: number[], contentLength?: number, contentType = 'model/gltf-binary') {
  let index = 0;
  return {
    ok: true,
    headers: {
      get: (name: string) => {
        const key = name.toLowerCase();
        if (key === 'content-type') return contentType;
        return key === 'content-length' && contentLength !== undefined
          ? String(contentLength)
          : null;
      },
    },
    body: {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) return { done: true, value: undefined };
          const size = chunks[index];
          // Only the first chunk carries the header, as on the wire.
          const value = index === 0 ? glbChunk(size) : new Uint8Array(size);
          index += 1;
          return { done: false, value };
        },
      }),
    },
  } as unknown as Response;
}

afterEach(() => {
  resetCriticalAssets();
  releaseCriticalAssets(assets);
  THREE.Cache.remove('/models/big.glb');
  vi.restoreAllMocks();
});

describe('the manifest', () => {
  it('names only files that exist under public/', () => {
    for (const asset of CRITICAL_ASSETS) {
      expect(asset.url.startsWith('/')).toBe(true);
      expect(asset.bytes).toBeGreaterThan(0);
    }
  });

  it('covers the models the opening shot cannot be drawn without', () => {
    const urls = CRITICAL_ASSETS.map((asset) => asset.url);
    expect(urls).toContain('/models/terrain-opt.glb');
    expect(urls).toContain('/models/me-animated-lite.glb');
    expect(urls).toContain('/models/crt-lite.glb');
    // The surf cannot break on a coastline it has not been given.
    expect(urls).toContain('/images/shore-field.png');
    expect(urls).toContain('/images/waternormals.jpg');
  });
});

describe('loadCriticalAssets', () => {
  it('reports progress by bytes arrived, not by files finished', async () => {
    // The whole reason for this module: one 800-byte model and one 200-byte
    // image are not half the load each.
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('.glb') ? streamed([400, 400], 800) : streamed([200], 200)
    ) as unknown as typeof fetch;

    const seen: number[] = [];
    await loadCriticalAssets((p) => seen.push(p.ratio), { assets, fetchImpl });

    // The first 400-byte chunk is 40% of the load, not 25% of the files.
    expect(seen.some((ratio) => ratio > 0.35 && ratio < 0.45)).toBe(true);
    expect(seen.at(-1)).toBe(1);
  });

  it('never lets the fill run backwards', async () => {
    // Content-Length can correct the estimate upward mid-flight, which would
    // otherwise drop the percentage and drain the letters.
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('.glb')
        ? streamed([100, 100], 4000)
        : streamed([200], 200)
    ) as unknown as typeof fetch;

    const seen: number[] = [];
    await loadCriticalAssets((p) => seen.push(p.ratio), { assets, fetchImpl });

    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });

  it('only reaches full once every file has settled', async () => {
    let releaseSecond: (() => void) | null = null;
    const held = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('.png')) await held;
      return streamed([String(url).endsWith('.glb') ? 800 : 200]);
    }) as unknown as typeof fetch;

    let latest = 0;
    const pending = loadCriticalAssets((p) => {
      latest = p.ratio;
    }, { assets, fetchImpl });

    await vi.waitFor(() => expect(latest).toBeGreaterThan(0.5));
    expect(latest).toBeLessThan(1);

    releaseSecond!();
    await pending;
    expect(latest).toBe(1);
  });

  it('hands the model bytes to three so nothing is fetched twice', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      streamed([String(url).endsWith('.glb') ? 800 : 200])
    ) as unknown as typeof fetch;

    await loadCriticalAssets(() => {}, { assets, fetchImpl });

    expect(THREE.Cache.get('/models/big.glb')).toBeDefined();
    // Textures go through ImageLoader, which would choke on a raw buffer.
    expect(THREE.Cache.get('/images/small.png')).toBeUndefined();
  });

  it('reassembles a streamed model exactly', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      streamed(String(url).endsWith('.glb') ? [300, 300, 200] : [200])
    ) as unknown as typeof fetch;

    await loadCriticalAssets(() => {}, { assets, fetchImpl });

    const cached = THREE.Cache.get('/models/big.glb') as ArrayBuffer;
    expect(cached.byteLength).toBe(800);
  });

  it('completes even when a file cannot be fetched at all', async () => {
    // A failed prefetch must not be able to trap someone on the loader; the
    // scene's own loader will ask for it again.
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('.glb')) throw new Error('offline');
      return streamed([200]);
    }) as unknown as typeof fetch;

    const result = await loadCriticalAssets(() => {}, { assets, fetchImpl });

    expect(result.ratio).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.settled).toBe(result.total);
  });

  it('treats a non-ok response as a failure rather than as content', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
    })) as unknown as typeof fetch;

    const result = await loadCriticalAssets(() => {}, { assets, fetchImpl });
    expect(result.failed).toBe(2);
    expect(result.ratio).toBe(1);
  });

  it('falls back to a whole-body read where streaming is unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'model/gltf-binary' : null) },
      body: null,
      arrayBuffer: async () => glbChunk(512).buffer,
    })) as unknown as typeof fetch;

    const result = await loadCriticalAssets(() => {}, { assets, fetchImpl });

    expect(result.ratio).toBe(1);
    expect(result.failed).toBe(0);
    expect((THREE.Cache.get('/models/big.glb') as ArrayBuffer).byteLength).toBe(512);
  });

  it('completes on an empty manifest rather than hanging', async () => {
    const result = await loadCriticalAssets(() => {}, { assets: [] });
    expect(result.ratio).toBe(1);
  });
});

describe('releaseCriticalAssets', () => {
  it('drops the model buffers once the scene has parsed them', async () => {
    const fetchImpl = vi.fn(async () =>
      streamed([256])
    ) as unknown as typeof fetch;

    await loadCriticalAssets(() => {}, { assets, fetchImpl });
    expect(THREE.Cache.get('/models/big.glb')).toBeDefined();

    releaseCriticalAssets(assets);
    expect(THREE.Cache.get('/models/big.glb')).toBeUndefined();
  });
});

describe('the shared run', () => {
  it('downloads the manifest once however many callers ask for it', async () => {
    /*
     * Measured in the browser before this existed: strict mode mounts effects
     * twice, and the island was requested three times over. On the slow
     * connection this path exists for, that is three times the wait.
     */
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return streamed([64]);
    }) as unknown as typeof fetch;

    try {
      const first: number[] = [];
      const second: number[] = [];

      const a = loadCriticalAssets((p) => first.push(p.ratio));
      const b = loadCriticalAssets((p) => second.push(p.ratio));

      await Promise.all([a, b]);

      expect(calls.length).toBe(CRITICAL_ASSETS.length);
      // Both callers see the load, including the state it was already in.
      expect(first.at(-1)).toBe(1);
      expect(second.at(-1)).toBe(1);
    } finally {
      globalThis.fetch = realFetch;
      for (const asset of CRITICAL_ASSETS) releaseCriticalAssets([asset]);
    }
  });

  it('lets a caller stop listening without cancelling the download', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => streamed([64])) as unknown as typeof fetch;

    try {
      const abandoned: number[] = [];
      const controller = new AbortController();

      const pending = loadCriticalAssets((p) => abandoned.push(p.ratio), {
        signal: controller.signal,
      });
      controller.abort();

      const result = await pending;

      // The bytes still arrived; the caller simply stopped hearing about it.
      expect(result.ratio).toBe(1);
      expect(abandoned.at(-1)).toBeLessThan(1);
    } finally {
      globalThis.fetch = realFetch;
      for (const asset of CRITICAL_ASSETS) releaseCriticalAssets([asset]);
    }
  });
});

describe('a host that rewrites missing paths to the app', () => {
  it('refuses a page served in place of an asset', async () => {
    /*
     * vercel.json rewrites every unmatched path to index.html, so a model that
     * is missing or misnamed answers 200 with a page rather than 404. Taking
     * that at its word would put HTML into three's cache as a model, and
     * GLTFLoader would fail on it with a parse error that names nothing
     * useful.
     */
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: {
        get: (n: string) =>
          n.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null,
      },
      body: null,
      arrayBuffer: async () => new TextEncoder().encode('<!doctype html>').buffer,
    })) as unknown as typeof fetch;

    const result = await loadCriticalAssets(() => {}, { assets, fetchImpl });

    expect(result.failed).toBe(2);
    expect(THREE.Cache.get('/models/big.glb')).toBeUndefined();
    // Still completes, so nobody is stranded on the loader.
    expect(result.ratio).toBe(1);
  });

  it('refuses a model whose bytes are not a binary glTF', async () => {
    // Belt and braces: a host that serves the fallback without a telltale
    // content-type still cannot poison the cache.
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      body: null,
      arrayBuffer: async () => new TextEncoder().encode('<!doctype html>').buffer,
    })) as unknown as typeof fetch;

    const result = await loadCriticalAssets(() => {}, { assets, fetchImpl });

    expect(THREE.Cache.get('/models/big.glb')).toBeUndefined();
    expect(result.failed).toBe(1);
  });
});
