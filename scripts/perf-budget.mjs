#!/usr/bin/env node
/**
 * Local runtime performance budget for the production build.
 *
 * Serves `dist` with `vite preview`, drives a real Chrome over the DevTools
 * protocol through the standard wheel journey under CPU throttling, then parks
 * on Contact, and fails when the median Long Animation Frame figures exceed
 * the gate in scripts/perf-budget.json; the tighter target is reported beside
 * it. The report in perf-reports/ keeps the build, browser, GPU and machine
 * provenance the numbers only mean anything with, and names the chapters the
 * long frames fell in.
 *
 *   bun run build && bun run perf:budget [--runs 3] [--cold] [--headed] [--chrome <path>] [--url <origin>]
 *
 * The journey's long frames vary between runs on one machine -- 23 to 91 in
 * three consecutive warm runs, most of the spread in About -- hence medians
 * of three runs by default.
 *
 * Budgets are for the machine class they were measured on (README >
 * Performance budget); a slower machine should record its own baseline rather
 * than loosen these.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const option = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith('--') ? true : value;
};
const config = JSON.parse(await readFile(resolve('scripts/perf-budget.json'), 'utf8'));
const runs = Math.max(1, Number(option('runs', 3)));
const headed = option('headed', false) === true;
const cold = option('cold', false) === true;
const { width, height } = config.viewport;

function chromeExecutable() {
  const explicit = option('chrome', process.env.CHROME_PATH);
  if (typeof explicit === 'string') return explicit;
  const local = process.env.LOCALAPPDATA ?? '';
  const candidates = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      join(local, 'Google/Chrome/Application/chrome.exe'),
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  }[process.platform] ?? [];
  return candidates.find(path => existsSync(path)) ?? 'google-chrome';
}

async function until(check, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await check();
    if (value) return value;
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function serve() {
  const url = option('url', null);
  if (typeof url === 'string') return { origin: url.replace(/\/$/, ''), stop: () => {} };
  if (!existsSync(resolve('dist/index.html'))) throw new Error('No dist build: run `bun run build` first.');
  const port = Number(option('port', 4319));
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const origin = `http://127.0.0.1:${port}`;
  await until(() => fetch(origin).then(response => response.ok, () => false), 30_000, `vite preview on ${origin}`);
  return { origin, stop: () => server.kill() };
}

async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'perf-budget-'));
  const chrome = spawn(chromeExecutable(), [
    ...(headed ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '';
  chrome.stderr.on('data', chunk => { log += chunk; });
  const endpoint = await until(() => /DevTools listening on (ws:\/\/\S+)/.exec(log)?.[1], 30_000, 'Chrome DevTools');
  return {
    endpoint,
    stop: async () => {
      chrome.kill();
      await new Promise(done => setTimeout(done, 500));
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((open, fail) => { socket.onopen = open; socket.onerror = fail; });
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const task = message.id && pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.fail(new Error(`${task.method}: ${message.error.message}`));
    else task.done(message.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((done, fail) => {
    const id = ++sequence;
    pending.set(id, { done, fail, method });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  return { send, page, evaluate, close: () => socket.close() };
}

const LOAF_OBSERVER = `(() => {
  window.__budgetFrames = [];
  // Where the reader was, so a failing budget names its chapter.
  const context = () => {
    const tv = document.querySelector('[data-testid="projects-stage"]')?.dataset.phase;
    const skills = document.querySelector('[data-testid="skills-stage"]')?.dataset.phase;
    const section = document.querySelector('[data-page-footer]')?.dataset.footerSection ?? '?';
    return section + (skills && skills !== 'outside' ? ' skills:' + skills : '') + (tv && tv !== 'outside' ? ' tv:' + tv : '');
  };
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      window.__budgetFrames.push({ ms: entry.duration, blocking: entry.blockingDuration, context: context() });
    }
  }).observe({ type: 'long-animation-frame', buffered: false });
})()`;

const summarise = frames => {
  const contexts = {};
  for (const frame of frames) {
    const bucket = contexts[frame.context] ??= { longFrames: 0, blockingMs: 0 };
    bucket.longFrames += 1;
    bucket.blockingMs += Math.round(frame.blocking);
  }
  return {
    longFrames: frames.length,
    blockingMs: Math.round(frames.reduce((total, frame) => total + frame.blocking, 0)),
    worstFrameMs: Math.round(Math.max(0, ...frames.map(frame => frame.ms))),
    contexts,
  };
};

async function open(origin, browser) {
  await browser.page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await browser.page('Page.enable');
  await browser.page('Page.navigate', { url: `${origin}/?perf-budget=${Date.now()}` });
  await until(() => browser.evaluate(`/settled/.test(document.querySelector('[data-testid="hero-content"]')?.className ?? '')`),
    120_000, 'the hero to settle');
}

async function measure(origin, browser) {
  const { page, evaluate } = browser;
  const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));
  await open(origin, browser);
  await pause(1500);

  await page('Emulation.setCPUThrottlingRate', { rate: config.cpuThrottle });
  await evaluate(LOAF_OBSERVER);
  const point = { x: Math.round(width * 0.9), y: Math.round(height * 0.87) };
  await page('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  const started = Date.now();
  while (Date.now() - started < config.journeySeconds * 1000) {
    for (let notch = 0; notch < 4; notch++) {
      await page('Input.dispatchMouseEvent', { type: 'mouseWheel', ...point, deltaX: 0, deltaY: 120 });
      await pause(45);
    }
    await pause(900);
  }
  await pause(1500);
  const journey = summarise(await evaluate('window.__budgetFrames'));

  await page('Emulation.setCPUThrottlingRate', { rate: 1 });
  await evaluate(`[...document.querySelectorAll('header button')].find(button => button.textContent.trim() === 'Contact')?.click()`);
  await pause(3000);
  await page('Emulation.setCPUThrottlingRate', { rate: config.cpuThrottle });
  await evaluate('window.__budgetFrames = []');
  await pause(config.contactSeconds * 1000);
  const parkedContact = summarise(await evaluate('window.__budgetFrames'));
  await page('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { journey, parkedContact };
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const server = await serve();
const chrome = await launch();
let failed = false;
try {
  const browser = await connect(chrome.endpoint);
  const { product } = await browser.send('Browser.getVersion');
  // A returning visit by default: the HTTP and shader caches are warm, as they are for a reader
  // who comes back. --cold measures the first visit of a fresh profile instead.
  if (!cold) {
    await open(server.origin, browser);
    await new Promise(done => setTimeout(done, 4000));
  }
  const results = [];
  for (let run = 1; run <= runs; run++) {
    const result = await measure(server.origin, browser);
    results.push(result);
    const brief = ({ contexts, ...totals }) => `${JSON.stringify(totals)} ${Object.entries(contexts)
      .sort((a, b) => b[1].blockingMs - a[1].blockingMs).slice(0, 3)
      .map(([name, bucket]) => `[${name}: ${bucket.longFrames} / ${bucket.blockingMs}ms]`).join(' ')}`;
    console.log(`run ${run}/${runs}: journey ${brief(result.journey)}; parked Contact ${brief(result.parkedContact)}`);
  }
  const provenance = await browser.evaluate(`(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl ? 'masked' : 'no WebGL',
      cores: navigator.hardwareConcurrency, memoryGb: navigator.deviceMemory ?? null,
      build: [...document.querySelectorAll('script[src], link[rel="modulepreload"]')]
        .map(element => (element.src || element.href).split('/').pop()),
    };
  })()`);
  browser.close();

  const verdict = [];
  for (const [phase, { gate, target }] of Object.entries(config.budgets)) {
    for (const [metric, limit] of Object.entries(gate)) {
      const value = median(results.map(result => result[phase][metric]));
      const pass = value <= limit;
      failed ||= !pass;
      verdict.push({ phase, metric, value, gate: limit, pass, target: target?.[metric], onTarget: value <= (target?.[metric] ?? Infinity) });
    }
  }
  console.table(verdict);
  await mkdir(resolve('perf-reports'), { recursive: true });
  const report = resolve('perf-reports', `perf-budget-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(report, JSON.stringify({
    date: new Date().toISOString(), browser: product, headed, cold, platform: process.platform,
    ...provenance, config, runs: results, verdict,
  }, null, 2));
  console.log(`${failed ? 'FAIL' : 'PASS'}: ${report}`);
} finally {
  await chrome.stop();
  server.stop();
}
process.exit(failed ? 1 : 0);
