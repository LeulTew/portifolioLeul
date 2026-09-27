import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  Scope, assertPortFree, awaitOwnedPreview, createCdp, openSocket, ownProcess, removeOwnedDirectory, terminateTree, until, type Cdp,
} from './harness';

/*
 * The owned preview server and Chrome every local browser tool uses: each
 * accepted only once it is the thing asked for, and gone with its scope.
 * Shared by the performance budget and the native scroll check.
 */

export function chromeExecutable(explicit: string | undefined): string {
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
export async function servePreview(scope: Scope, port: number): Promise<string> {
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
export async function launchChrome(scope: Scope, { executable, headed, width, height, flags = [] }: {
  executable: string; headed: boolean; width: number; height: number;
  /** More switches, after the owned ones. */
  flags?: string[];
}): Promise<Cdp> {
  const profile = await mkdtemp(join(tmpdir(), 'perf-budget-'));
  // Windows lets go of a closed Chrome's files a moment after its processes exit.
  scope.defer('remove the Chrome profile', () => removeOwnedDirectory(profile, {
    remove: path => rm(path, { recursive: true, force: true }),
  }));
  const child = spawn(executable, [
    ...(headed ? [] : ['--headless=new']), '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', `--window-size=${width},${height}`,
    // No crash handler, updater or background fetches: nothing that outlives Chrome or competes with the page.
    '--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--no-service-autorun',
    ...flags, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const chrome = ownProcess(child, 'Chrome', {
    // A loaded machine takes a while to reap a whole browser; a forced tree stop is final, only slow.
    graceMs: 10_000,
    terminate: terminateTree(child, { run: (command, args) => { spawnSync(command, args, { stdio: 'ignore' }); } }),
  });
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
  // Asked to close, Chrome takes its renderer and GPU processes with it and lets go of the profile --
  // once it has exited. Stopping it while it was still closing ended only its main process on
  // Windows and left the rest running (round 20, TECH-064).
  scope.defer('close Chrome', async () => {
    await cdp.send('Browser.close', {}, { timeoutMs: 5000 }).catch(() => {});
    await chrome.settle(15_000);
  });
  return cdp;
}
