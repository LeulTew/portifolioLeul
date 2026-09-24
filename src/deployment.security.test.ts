import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CONTACT_SEND_ENDPOINT } from './components/sections/Contact/contactDelivery';
import { projectsData } from './data/projects';
import { CRITICAL_ASSETS, getCriticalAssets } from './lib/assets/criticalAssets';
import { TV_VIDEO_URL } from './lib/tv/tvMedia';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const deployment = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers?: HeaderRule[] };
const headers = Object.fromEntries(
  (deployment.headers ?? [])
    .filter(rule => rule.source === '/(.*)')
    .flatMap(rule => rule.headers.map(({ key, value }) => [key, value])),
);
const policy = new Map(
  (headers['Content-Security-Policy'] ?? '').split(';').filter(Boolean).map(directive => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }),
);

describe('deployment response security', () => {
  it('covers every response with frame, MIME, referrer and feature boundaries', () => {
    expect(headers).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    expect(policy.get('default-src')).toEqual(["'self'"]);
    for (const directive of ['base-uri', 'object-src', 'frame-src', 'frame-ancestors', 'script-src-attr']) {
      expect(policy.get(directive), directive).toEqual(["'none'"]);
    }
    expect(policy.get('form-action')).toEqual(["'self'"]);
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
    expect(headers['Permissions-Policy']).toContain('autoplay=(self)');
    expect(headers['Permissions-Policy']).toContain('fullscreen=(self)');
  });

  it('hashes the exact inline theme and structured-data scripts, without permitting arbitrary JavaScript', () => {
    // HTML parsing normalizes Windows line endings before CSP hashes are evaluated.
    const html = readFileSync('index.html', 'utf8').replace(/\r\n?/g, '\n');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes]) => !/\bsrc\s*=/.test(attributes));
    const hashes = scripts.map(([, , text]) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`);

    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some(([, , text]) => text.includes("localStorage.getItem('theme')"))).toBe(true);
    expect(policy.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", ...hashes]);
    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
    expect(policy.get('script-src')).not.toContain("'unsafe-eval'");
    const injectedHash = `'sha256-${createHash('sha256').update('alert("injected")').digest('base64')}'`;
    expect(policy.get('script-src')).not.toContain(injectedHash);
  });

  it('allows only same-origin stylesheets, local fonts, embedded model textures and deliberate local TV media', () => {
    // Animation writes go through the CSSOM, which CSP does not govern; markup may not carry inline styles.
    expect(policy.get('style-src')).toEqual(["'self'"]);
    const html = readFileSync(path.resolve('index.html'), 'utf8');
    expect(html).not.toMatch(/\sstyle=["']/);
    expect(html).not.toMatch(/<style[\s>]/);
    expect(policy.get('font-src')).toEqual(["'self'"]);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(policy.get('media-src')).toEqual(["'self'", 'blob:']);
    expect(policy.get('worker-src')).toEqual(["'self'", 'blob:']);

    const origin = 'https://portfolio.example';
    const assets = [
      ...CRITICAL_ASSETS.map(asset => asset.url),
      ...getCriticalAssets(true).map(asset => asset.url),
      ...projectsData.map(project => project.image),
      TV_VIDEO_URL,
    ];
    for (const asset of assets) expect(new URL(asset, origin).origin, asset).toBe(origin);
    for (const stylesheet of [
      path.join('src', 'components', 'sections', 'Skills', 'Skills.module.css'),
      path.join('src', 'components', 'sections', 'About', 'EducationRail', 'EducationRail.module.css'),
    ]) {
      const css = readFileSync(stylesheet, 'utf8');
      const fonts = [...css.matchAll(/src:\s*url\(['"]([^'"]+)['"]\)/g)];
      expect(fonts.length).toBeGreaterThan(0);
      for (const [, font] of fonts) expect(new URL(font, origin).origin, font).toBe(origin);
    }
  });

  it('limits cross-origin requests to the actual EmailJS endpoint, not project links or arbitrary hosts', () => {
    const emailOrigin = new URL(CONTACT_SEND_ENDPOINT).origin;
    expect(emailOrigin).toBe('https://api.emailjs.com');
    expect(policy.get('connect-src')).toEqual(["'self'", 'blob:', emailOrigin]);
    for (const sources of policy.values()) {
      expect(sources).not.toContain('*');
      expect(sources).not.toContain('https:');
      expect(sources).not.toContain('http:');
    }
    // These would also restrict ordinary project links, device redirects or mailto navigation.
    expect(policy.has('navigate-to')).toBe(false);
    expect(policy.has('sandbox')).toBe(false);
  });
});

describe('local Vite exposure', () => {
  const sensitiveFiles = ['.env', '.env.local', 'private.pem', 'private.crt', path.join('.git', 'config'), '.env::$DATA', 'private.pem::$DATA'];
  let result: {
    host: string;
    allowedHosts: string[] | boolean;
    strict: boolean;
    allow: string[];
    files: Record<string, boolean>;
    explicitHost: string;
    explicitStrict: boolean;
    previewHost: string;
    previewHeaders: Record<string, string>;
    developmentCsp?: string;
    hmr?: boolean;
  };
  beforeAll(() => {
    const files = {
      entry: path.resolve('src', 'bootstrap.ts'),
      outside: path.resolve('..', 'outside-checkout.txt'),
      shortAlias: path.resolve('SECRET~1'),
      ...Object.fromEntries(sensitiveFiles.map(file => [file, path.resolve(file)])),
    };
    // Resolve the real configuration in Node: jsdom's Uint8Array realm is incompatible with esbuild.
    const script = `
      import { isFileLoadingAllowed, normalizePath, resolveConfig } from 'vite';
      const options = { configFile: 'vite.config.ts', logLevel: 'silent' };
      const config = await resolveConfig(options, 'serve');
      const explicit = await resolveConfig({ ...options, server: { host: '0.0.0.0' } }, 'serve');
      console.log(JSON.stringify({
        host: config.server.host,
        allowedHosts: config.server.allowedHosts,
        strict: config.server.fs.strict,
        allow: config.server.fs.allow,
        files: Object.fromEntries(Object.entries(${JSON.stringify(files)})
          .map(([name, file]) => [name, isFileLoadingAllowed(config, normalizePath(file))])),
        explicitHost: explicit.server.host,
        explicitStrict: explicit.server.fs.strict,
        previewHost: config.preview.host,
        previewHeaders: config.preview.headers,
        developmentCsp: config.server.headers?.['Content-Security-Policy'],
        hmr: config.server.hmr,
      }));
    `;
    result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: { ...process.env, VITEST: '' },
      timeout: 15_000,
    }));
  }, 20_000);

  it('binds to loopback and restricts filesystem access to this checkout', () => {
    expect(result.host).toBe('127.0.0.1');
    expect(result.allowedHosts).not.toBe(true);
    expect(result.strict).toBe(true);
    expect(result.allow).toEqual([process.cwd().replaceAll('\\', '/')]);
    expect(result.files.entry).toBe(true);
    expect(result.files.outside).toBe(false);
  });

  it.each(sensitiveFiles)(
    'does not serve sensitive or alternate-stream path %s',
    file => {
      expect(result.files[file]).toBe(false);
    },
  );

  it.runIf(process.platform === 'win32')('rejects Windows short-name aliases before reading a file', () => {
    expect(result.files.shortAlias).toBe(false);
  });

  it('allows an explicit Vite host override without weakening the filesystem boundary', () => {
    expect(result.explicitHost).toBe('0.0.0.0');
    expect(result.explicitStrict).toBe(true);
  });

  it('mirrors deployment headers in preview, without applying production CSP to development HMR', () => {
    expect(result.previewHost).toBe('127.0.0.1');
    expect(result.previewHeaders).toEqual(headers);
    expect(result.developmentCsp).toBeUndefined();
    expect(result.hmr).not.toBe(false);
  });
});

describe('patched toolchain resolution', () => {
  it('does not retain vulnerable nested copies of the upgraded package families', () => {
    const lock = JSON.parse(readFileSync('bun.lock', 'utf8').replace(/,\s*([}\]])/g, '$1')) as {
      packages: Record<string, [string, ...unknown[]]>;
    };
    const versions = [...new Set(Object.values(lock.packages).map(([version]) => version))];
    for (const [name, expected] of Object.entries({
      '@babel/core': ['@babel/core@7.29.7'],
      '@humanfs/node': ['@humanfs/node@0.16.8'],
      vite: ['vite@6.4.3'],
      vitest: ['vitest@4.1.11'],
      'happy-dom': ['happy-dom@20.8.9'],
      ajv: ['ajv@6.14.0'],
      'baseline-browser-mapping': ['baseline-browser-mapping@2.11.0'],
      'brace-expansion': ['brace-expansion@1.1.18', 'brace-expansion@5.0.12'],
      browserslist: ['browserslist@4.28.7'],
      fflate: ['fflate@0.6.11', 'fflate@0.8.3'],
      'js-yaml': ['js-yaml@4.3.2'],
      minimatch: ['minimatch@3.1.4', 'minimatch@9.0.7'],
      rollup: ['rollup@4.63.4'],
      postcss: ['postcss@8.5.28'],
      'postcss-selector-parser': ['postcss-selector-parser@6.1.3'],
      flatted: ['flatted@3.4.2'],
      picomatch: ['picomatch@2.3.2', 'picomatch@4.0.7'],
      ws: ['ws@8.21.0'],
    })) {
      expect(versions.filter(version => version.startsWith(`${name}@`)).sort(), name).toEqual(expected);
    }
    for (const version of versions.filter(version => version.startsWith('@vitest/'))) {
      expect(version).toMatch(/@4\.1\.11$/);
    }
  });

  it('does not collapse incompatible transitive version families into a global override', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const name of ['brace-expansion', 'fflate', 'minimatch']) {
      expect(manifest.overrides).not.toHaveProperty(name);
    }
    expect(manifest.overrides).toMatchObject({
      'brace-expansion@1': '1.1.18',
      'brace-expansion@5': '5.0.12',
      'fflate@0.6': '0.6.11',
      'fflate@0.8': '0.8.3',
      'minimatch@3': '3.1.4',
      'minimatch@9': '9.0.7',
    });
  });

  it.each([
    ['three-stdlib', 'fflate', '0.6.11'],
    ['@vitest/ui', 'fflate', '0.8.3'],
    ['eslint', 'minimatch', '3.1.4'],
    ['@typescript-eslint/typescript-estree', 'minimatch', '9.0.7'],
    ['tailwindcss', 'postcss', '8.5.28'],
    ['postcss-load-config', 'postcss', '8.5.28'],
    ['@vitejs/plugin-react', '@babel/core', '7.29.7'],
    ['jsdom', 'ws', '8.21.0'],
    ['happy-dom', 'ws', '8.21.0'],
  ])('%s actually resolves %s to %s, without a stale installed copy shadowing the lock', (owner, dependency, version) => {
    const modules = path.resolve('node_modules');
    const ownerRequire = createRequire(path.join(modules, ...owner.split('/'), 'package.json'));
    let directory = path.dirname(ownerRequire.resolve(dependency));
    while (directory.startsWith(`${modules}${path.sep}`)) {
      const manifestPath = path.join(directory, 'package.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.name === dependency) {
          expect(manifest.version).toBe(version);
          return;
        }
      }
      directory = path.dirname(directory);
    }
    throw new Error(`Could not find the installed manifest for ${owner} -> ${dependency}`);
  });
});
