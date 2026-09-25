#!/usr/bin/env bun
/**
 * Local runtime performance budget for the production build.
 *
 * Serves `dist` with `vite preview` (or measures `--url`), drives a real
 * Chrome over the DevTools protocol from Home to a usable Contact with the
 * mouse wheel under CPU throttling, parks on Contact, types into its form,
 * and fails unless every sample travelled the whole story without a page
 * error and the medians of its figures are within the gates in
 * scripts/perf-budget.json. The report in perf-reports/ records the commit,
 * the build, the browser, the GPU, the machine, each sample's cache state and
 * the chapters its long frames fell in.
 *
 *   bun run build && bun run perf:budget [--runs 3] [--cold] [--headed] [--chrome <path>] [--url <origin>] [--port 4319]
 *
 * Samples are returning visits by default: one Chrome profile, warmed by an
 * unmeasured visit, so the HTTP and shader caches are warm. `--cold` gives
 * every sample a fresh profile, throttles from before navigation, and gates
 * the startup as well. Budgets hold for the machine class they were set on
 * (README > Performance budget); a slower machine should record its own
 * baseline rather than loosen them.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  Scope, assertPortFree, awaitOwnedPreview, createCdp, delay, openSocket, ownProcess, scoped, until, type Cdp,
} from './perf/harness';
import {
  PAGE_PROBE, UsageError, checkJourney, journeyPath, judge, parseOptions, summariseFrames, summariseIntervals,
  type BudgetConfig, type PageTrace, type Phase, type Sample,
} from './perf/measures';

const USAGE = 'Usage: bun run perf:budget [--runs 1-15] [--cold] [--headed] [--chrome <path>] [--url <origin> | --port <port>]';

function chromeExecutable(explicit: string | undefined): string {
  if (explicit) return explicit;
  const local = process.env.LOCALAPPDATA ?? '';
  const candidates: Record<string, string[]> = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      join(local, 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  };
  return (candidates[process.platform] ?? []).find(path => existsSync(path)) ?? 'google-chrome';
}

/** Serves dist on the port, and only accepts the server once it is serving this build. */
async function servePreview(scope: Scope, port: number): Promise<string> {
  const indexPath = resolve('dist/index.html');
  if (!existsSync(indexPath)) throw new Error('No dist build: run `bun run build` first.');
  await assertPortFree(port);
  const child = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const preview = ownProcess(child, 'vite preview');
  scope.defer('stop vite preview', () => preview.stop());
  let log = '';
  child.stderr?.on('data', chunk => { log = (log + String(chunk)).slice(-2000); });
  const origin = `http://127.0.0.1:${port}`;
  try {
    await awaitOwnedPreview(preview, origin, await readFile(indexPath, 'utf8'));
  } catch (error) {
    throw new Error(`${(error as Error).message}${log.trim() ? `\n${log.trim()}` : ''}`);
  }
  return origin;
}

/** A Chrome of its own, on a profile of its own; both go when the scope closes. */
async function launchChrome(scope: Scope, { executable, headed, width, height }: {
  executable: string; headed: boolean; width: number; height: number;
}): Promise<Cdp> {
  const profile = await mkdtemp(join(tmpdir(), 'perf-budget-'));
  // Windows lets go of a closed Chrome's files a moment after its processes exit.
  scope.defer('remove the Chrome profile', () => rm(profile, { recursive: true, force: true, maxRetries: 25, retryDelay: 200 }));
  const child = spawn(executable, [
    ...(headed ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--window-size=${width},${height}`,
    // No crash handler, updater or background fetches: nothing that outlives Chrome or competes with the page.
    '--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--no-service-autorun',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const chrome = ownProcess(child, 'Chrome');
  scope.defer('stop Chrome', () => chrome.stop());
  let log = '';
  let endpoint: string | undefined;
  child.stderr?.on('data', chunk => {
    if (endpoint) return;
    log += String(chunk);
    endpoint = /DevTools listening on (ws:\/\/\S+)/.exec(log)?.[1];
  });
  const url = await until(() => {
    if (chrome.exitCode !== undefined) {
      throw new Error(`Chrome exited (${chrome.startError?.message ?? `code ${chrome.exitCode}`}) before DevTools started`);
    }
    return endpoint;
  }, { timeoutMs: 30_000, label: 'Chrome DevTools' });
  const cdp = createCdp(await openSocket(url));
  scope.defer('close the DevTools connection', () => cdp.close());
  // Asked to close, Chrome takes its renderer and GPU processes with it and lets go of the profile.
  scope.defer('close Chrome', () => cdp.send('Browser.close', {}, { timeoutMs: 5000 }).catch(() => {}));
  return cdp;
}

interface Page {
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  evaluate<T>(expression: string, timeoutMs?: number): Promise<T>;
  /** Page errors, failed requests and console errors, in arrival order. */
  readonly errors: string[];
  /** Bytes received over the network. */
  readonly bytes: number;
}

interface ExceptionDetails { text: string; exception?: { description?: string } }

/** The protocol events a page's health is read from. */
interface PageEvents {
  'Runtime.exceptionThrown': { exceptionDetails: ExceptionDetails };
  'Runtime.consoleAPICalled': { type: string; args: { value?: unknown; description?: string }[] };
  'Log.entryAdded': { entry: { level: string; source: string; text: string; url?: string } };
  'Network.requestWillBeSent': { requestId: string; request: { url: string } };
  'Network.loadingFinished': { requestId: string; encodedDataLength: number };
  'Network.loadingFailed': { requestId: string; errorText: string; canceled?: boolean };
  'Network.responseReceived': { response: { status: number; url: string } };
}

async function openPage(cdp: Cdp, { width, height }: BudgetConfig['viewport']): Promise<Page> {
  const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
  const send = <T>(method: string, params?: Record<string, unknown>, timeoutMs?: number) =>
    cdp.send<T>(method, params, { sessionId, timeoutMs });
  const on = <K extends keyof PageEvents>(method: K, listener: (params: PageEvents[K]) => void) =>
    cdp.on(method, (params, session) => { if (session === sessionId) listener(params as unknown as PageEvents[K]); });
  const errors: string[] = [];
  const report = (text: string) => { if (!errors.includes(text)) errors.push(text); };
  const urls = new Map<string, string>();
  let bytes = 0;
  on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    report(`uncaught: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  });
  on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type === 'error' || type === 'assert') {
      report(`console.${type}: ${args.map(arg => String(arg.value ?? arg.description ?? '')).join(' ')}`);
    }
  });
  on('Log.entryAdded', ({ entry }) => {
    if (entry.level === 'error') report(`${entry.source}: ${entry.text}${entry.url ? ` (${entry.url})` : ''}`);
  });
  on('Network.requestWillBeSent', ({ requestId, request }) => { urls.set(requestId, request.url); });
  on('Network.loadingFinished', ({ encodedDataLength }) => { bytes += encodedDataLength; });
  on('Network.loadingFailed', ({ requestId, errorText, canceled }) => {
    if (!canceled) report(`failed to load ${urls.get(requestId) ?? requestId}: ${errorText}`);
  });
  on('Network.responseReceived', ({ response }) => {
    if (response.status >= 400) report(`HTTP ${response.status}: ${response.url}`);
  });
  for (const domain of ['Page', 'Runtime', 'Log', 'Network']) await send(`${domain}.enable`);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_PROBE });
  return {
    send,
    async evaluate<T>(expression: string, timeoutMs?: number) {
      const { result, exceptionDetails } = await send<{ result: { value?: unknown }; exceptionDetails?: ExceptionDetails }>(
        'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value as T;
    },
    errors,
    get bytes() { return bytes; },
  };
}

/** Where a pointer lands on Contact's name field, once a reader can use it; null before. */
const CONTACT_FIELD = String.raw`(() => {
  const field = document.querySelector('#contact input[name="name"]');
  if (!field || field.closest('[inert], [aria-hidden="true"]')) return null;
  const box = field.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  if (!box.width || !box.height || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
  const hit = document.elementFromPoint(x, y);
  return hit && (hit === field || field.contains(hit)) ? { x: Math.round(x), y: Math.round(y) } : null;
})()`;

const FOOTER_SECTION = `document.querySelector('[data-testid="page-footer"]')?.getAttribute('data-footer-section') ?? ''`;

async function navigate(page: Page, origin: string) {
  const { errorText } = await page.send<{ errorText?: string }>('Page.navigate', { url: `${origin}/?perf-budget=${Date.now()}` });
  if (errorText) throw new Error(`Navigation to ${origin} failed: ${errorText}`);
  return until(() => page.evaluate<number | null>('window.__budget?.readyAt ?? null'),
    { timeoutMs: 120_000, label: 'the hero to settle', intervalMs: 50 });
}

async function takeSample(page: Page, origin: string, config: BudgetConfig, { cold, cache, errorsFrom }: {
  cold: boolean; cache: string; errorsFrom: number;
}): Promise<Sample> {
  const throttle = (rate: number) => page.send('Emulation.setCPUThrottlingRate', { rate });
  try {
    return await travel(page, origin, config, { cold, cache, errorsFrom, throttle });
  } finally {
    await throttle(1).catch(() => {});
  }
}

async function travel(page: Page, origin: string, config: BudgetConfig, { cold, cache, errorsFrom, throttle }: {
  cold: boolean; cache: string; errorsFrom: number; throttle: (rate: number) => Promise<unknown>;
}): Promise<Sample> {
  const { width, height } = config.viewport;
  const failures: string[] = [];
  const enter = (phase: Phase) => page.evaluate(`window.__budget.enter(${JSON.stringify(phase)})`);

  if (cold) await throttle(config.cpuThrottle);
  const bytesBefore = page.bytes;
  const readyAt = await navigate(page, origin);
  const transferKb = Math.round((page.bytes - bytesBefore) / 1024);
  await delay(1500);
  if (!cold) await throttle(config.cpuThrottle);

  const point = { x: Math.round(width * 0.9), y: Math.round(height * 0.87) };
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await page.evaluate('window.__budget.enter("journey"), window.__budget.sample(true)');
  const started = Date.now();
  const deadline = started + config.journeyTimeoutSeconds * 1000;
  const atContact = async () => (await page.evaluate<string>(FOOTER_SECTION)) === 'contact';
  let arrived = await atContact();
  while (!arrived && Date.now() < deadline) {
    for (let notch = 0; notch < 4; notch++) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX: 0, deltaY: 120 });
      await delay(45);
    }
    await delay(900);
    arrived = await atContact();
  }
  // The journey ends where a reader can use Contact, its arrival included.
  const field = arrived
    ? await until(() => page.evaluate<{ x: number; y: number } | null>(CONTACT_FIELD),
      { timeoutMs: 20_000, label: 'Contact to become usable' }).catch(() => null)
    : null;
  if (!arrived) failures.push(`the journey did not reach Contact within ${config.journeyTimeoutSeconds}s`);
  else if (!field) failures.push('Contact never became usable after the journey arrived');
  await delay(1500);
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  await page.evaluate('window.__budget.sample(false)');

  await enter('settle');
  await delay(3000);
  await enter('contact');
  await delay(config.contactSeconds * 1000);

  await enter('interaction');
  const target = field && await page.evaluate<{ x: number; y: number } | null>(CONTACT_FIELD);
  if (target) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...target });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...target, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...target, button: 'left', clickCount: 1 });
    for (const character of 'Perf') {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: character, text: character });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: character });
      await delay(120);
    }
    await delay(1000);
  } else if (field) failures.push("Contact's name field could not be reached for typing");
  await enter('done');

  const trace = JSON.parse(await page.evaluate<string>('JSON.stringify(window.__budget)')) as PageTrace;
  const skillChapters = await page.evaluate<number>(`document.querySelectorAll('[aria-label="Skills chapters"] button').length`);
  const educationRecords = await page.evaluate<number>(`document.querySelectorAll('[data-testid="education-progress"] > li').length`);
  failures.push(...checkJourney(trace.checkpoints, skillChapters, educationRecords));
  for (const type of ['long-animation-frame', 'event']) {
    if (trace.unsupported.includes(type)) failures.push(`this browser does not report ${type} entries`);
  }
  failures.push(...page.errors.slice(errorsFrom));
  const frames = (phase: Phase) => trace.frames.filter(frame => frame.phase === phase);
  const load = summariseFrames(frames('load'));
  const events = trace.events.filter(event => event.phase === 'interaction');
  return {
    cache,
    path: journeyPath(trace.checkpoints),
    checkpoints: trace.checkpoints,
    startup: {
      readyMs: readyAt, fcpMs: trace.fcp, lcpMs: trace.lcp, transferKb,
      longFrames: load.longFrames, blockingMs: load.blockingMs,
    },
    journey: { ...summariseFrames(frames('journey')), ...summariseIntervals(trace.intervals), seconds },
    parkedContact: summariseFrames(frames('contact')),
    interaction: { worstEventMs: Math.round(Math.max(0, ...events.map(event => event.ms))), events: events.length },
    failures,
  };
}

function failedSample(cache: string, error: unknown): Sample {
  const none = { longFrames: NaN, blockingMs: NaN, worstFrameMs: NaN, worstContext: '', contexts: {} };
  return {
    cache,
    path: [],
    checkpoints: [],
    startup: { readyMs: null, fcpMs: null, lcpMs: null, transferKb: NaN, longFrames: NaN, blockingMs: NaN },
    journey: { ...none, frames: 0, p50FrameMs: NaN, p95FrameMs: NaN, p99FrameMs: NaN, missedFramePercent: NaN, seconds: NaN },
    parkedContact: none,
    interaction: { worstEventMs: NaN, events: 0 },
    failures: [`the sample could not be taken: ${(error as Error).message}`],
  };
}

function describeSample(sample: Sample): string {
  const { journey, parkedContact, interaction, startup } = sample;
  const worst = Object.entries(journey.contexts).sort((a, b) => b[1].blockingMs - a[1].blockingMs).slice(0, 3)
    .map(([name, bucket]) => `${name}: ${bucket.longFrames}/${bucket.blockingMs}ms`).join(', ');
  return [
    `  journey ${journey.seconds}s: ${journey.longFrames} long frames, ${journey.blockingMs}ms blocking,`
      + ` worst ${journey.worstFrameMs}ms${journey.worstContext ? ` (${journey.worstContext}${journey.worstCause ? `; ${journey.worstCause}` : ''})` : ''};`
      + ` frames p95 ${journey.p95FrameMs}ms, ${journey.missedFramePercent}% missed${worst ? ` [${worst}]` : ''}`,
    `  parked Contact: ${parkedContact.longFrames} long frames, ${parkedContact.blockingMs}ms blocking; typing: worst event ${interaction.worstEventMs}ms`,
    `  startup: ready ${startup.readyMs}ms, LCP ${startup.lcpMs}ms, ${startup.transferKb} KB, ${startup.blockingMs}ms blocking`,
    ...sample.failures.length && sample.path.length ? [`  path: ${sample.path.join(' > ')}`] : [],
    ...sample.failures.map(failure => `  FAILED: ${failure}`),
  ].join('\n');
}

function git(...args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

async function main() {
  const options = parseOptions(process.argv.slice(2), process.env);
  const config = JSON.parse(await readFile(resolve('scripts/perf-budget.json'), 'utf8')) as BudgetConfig;
  const { width, height } = config.viewport;
  const scope = new Scope();
  const interrupt = (signal: string) => {
    console.error(`${signal}: stopping the preview and Chrome`);
    void scope.close().finally(() => process.exit(130));
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const origin = options.url ?? await servePreview(scope, options.port);
    const chrome = { executable: chromeExecutable(options.chrome), headed: options.headed, width, height };
    const samples: Sample[] = [];
    let provenance: Record<string, unknown> = {};
    const record = async (cdp: Cdp, page: Page) => {
      if (Object.keys(provenance).length) return;
      const { product } = await cdp.send<{ product: string }>('Browser.getVersion');
      provenance = {
        browser: product,
        ...await page.evaluate<Record<string, unknown>>(`(() => {
          const gl = document.createElement('canvas').getContext('webgl');
          const debug = gl && gl.getExtension('WEBGL_debug_renderer_info');
          return {
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl ? 'masked' : 'no WebGL',
            cores: navigator.hardwareConcurrency, memoryGb: navigator.deviceMemory ?? null,
            build: [...document.querySelectorAll('script[src], link[rel="modulepreload"]')]
              .map(element => (element.src || element.href).split('/').pop()),
          };
        })()`),
      };
    };
    const run = async (index: number, cache: string, sample: () => Promise<Sample>) => {
      const result = await sample().catch(error => failedSample(cache, error));
      samples.push(result);
      console.log(`sample ${index}/${options.runs} (${cache})\n${describeSample(result)}`);
    };

    if (options.cold) {
      for (let index = 1; index <= options.runs; index++) {
        // Each cold sample owns its Chrome and profile; Ctrl+C closes them through the run's scope.
        const cache = 'fresh profile: empty HTTP, shader and storage caches';
        await run(index, cache, async () => {
          const { outcome, cleanup } = await scoped(scope, `sample ${index}`, async own => {
            const cdp = await launchChrome(own, chrome);
            const page = await openPage(cdp, config.viewport);
            const sample = await takeSample(page, origin, config, { cold: true, cache, errorsFrom: 0 });
            await record(cdp, page);
            return sample;
          });
          const sample = outcome.status === 'fulfilled' ? outcome.value : failedSample(cache, outcome.reason);
          // A Chrome or profile that outlived its sample shares the machine with the next one.
          sample.failures.push(...cleanup.map(error => `cleanup: ${error.message}`));
          return sample;
        });
      }
    } else {
      const cdp = await launchChrome(scope, chrome);
      const page = await openPage(cdp, config.viewport);
      await navigate(page, origin);
      await delay(4000);
      for (let index = 1; index <= options.runs; index++) {
        const cache = `returning visit ${index + 1}: HTTP and shader caches warm`;
        // The first sample answers for errors in the unmeasured visit too.
        const errorsFrom = index === 1 ? 0 : page.errors.length;
        await run(index, cache, () => takeSample(page, origin, config, { cold: false, cache, errorsFrom }));
      }
      await record(cdp, page);
    }

    const verdict = judge(config, samples, { cold: options.cold });
    console.table(verdict.rows);
    const indexPath = resolve('dist/index.html');
    await mkdir(resolve('perf-reports'), { recursive: true });
    const report = resolve('perf-reports', `perf-budget-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(report, JSON.stringify({
      date: new Date().toISOString(),
      commit: git('rev-parse', 'HEAD'),
      dirty: git('status', '--porcelain') !== '',
      origin,
      server: options.url ? 'external: not verified against dist' : 'owned vite preview, verified serving dist/index.html',
      distIndexSha256: !options.url && existsSync(indexPath)
        ? createHash('sha256').update(await readFile(indexPath)).digest('hex') : null,
      mode: options.cold ? 'cold' : 'returning visit',
      headed: options.headed, platform: process.platform, ...provenance, config, samples, verdict,
    }, null, 2));
    for (const failure of verdict.failures) console.error(`FAILED: ${failure}`);
    console.log(`${verdict.pass ? 'PASS' : 'FAIL'}: ${report}`);
    process.exitCode = verdict.pass ? 0 : 1;
  } finally {
    const errors = await scope.close();
    for (const error of errors) console.error(`cleanup: ${error.message}`);
    if (errors.length) process.exitCode = 1;
  }
}

main().then(
  () => process.exit(),
  error => {
    console.error(error instanceof UsageError ? `${error.message}\n${USAGE}` : error);
    process.exit(error instanceof UsageError ? 2 : 1);
  },
);
