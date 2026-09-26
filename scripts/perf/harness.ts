/**
 * Process, browser and protocol plumbing for the performance budget, written
 * so that nothing it starts can outlive it or measure the wrong thing.
 *
 * Round 8 (TECH-014): the first harness started its preview and Chrome before
 * any cleanup was in place, accepted any server that answered on its port as
 * its own, and sent DevTools requests that could wait forever. Here every
 * resource is handed to a `Scope` the moment it exists and released in
 * reverse order on success, failure or Ctrl+C; the preview is identified by
 * the build it serves; and every protocol request has a deadline and fails
 * when the connection drops.
 */
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const delay = (milliseconds: number) => new Promise<void>(done => setTimeout(done, milliseconds));

/** Rejects with `label` if `promise` has not settled within `milliseconds`. */
export function withTimeout<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new Error(`Timed out after ${milliseconds}ms: ${label}`)), milliseconds);
  });
  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}

/**
 * Polls `check` until it returns a value other than null, undefined or false.
 * A check that throws ends the wait with its error; one that hangs is bounded
 * by the time the wait has left.
 */
export async function until<T>(
  check: () => T | null | undefined | false | Promise<T | null | undefined | false>,
  { timeoutMs, label, intervalMs = 100 }: { timeoutMs: number; label: string; intervalMs?: number },
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const value = await withTimeout(Promise.resolve().then(check), remaining, label);
    if (value !== null && value !== undefined && value !== false) return value;
    await delay(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
}

/**
 * Everything a run acquires, released last-in first-out exactly once.
 * Cleanup errors are collected rather than thrown over one another, and a
 * resource handed over once the scope has closed is released at once.
 */
export class Scope {
  private readonly cleanups: { label: string; release: () => unknown }[] = [];
  private closing: Promise<Error[]> | null = null;
  private closed = false;

  defer(label: string, release: () => unknown): void {
    if (this.closed) {
      void Promise.resolve().then(release).catch(() => {});
      return;
    }
    this.cleanups.push({ label, release });
  }

  close(): Promise<Error[]> {
    this.closing ??= (async () => {
      const errors: Error[] = [];
      for (let cleanup = this.cleanups.pop(); cleanup; cleanup = this.cleanups.pop()) {
        try {
          await cleanup.release();
        } catch (error) {
          errors.push(new Error(`${cleanup.label}: ${message(error)}`));
        }
      }
      this.closed = true;
      return errors;
    })();
    return this.closing;
  }
}

/**
 * Runs `work` in a scope of its own, closed however `work` ends, and returns
 * the cleanup errors beside the outcome instead of letting a log line swallow
 * them (round 9, TECH-023). The parent scope closes it too if the run is
 * interrupted first.
 */
export async function scoped<T>(parent: Scope, label: string, work: (scope: Scope) => Promise<T>):
  Promise<{ outcome: PromiseSettledResult<T>; cleanup: Error[] }> {
  const own = new Scope();
  parent.defer(label, () => own.close());
  const outcome = await work(own).then(
    (value): PromiseSettledResult<T> => ({ status: 'fulfilled', value }),
    (reason: unknown): PromiseSettledResult<T> => ({ status: 'rejected', reason }),
  );
  return { outcome, cleanup: await own.close() };
}

export interface OwnedProcess {
  readonly label: string;
  /** The exit code, null for a signal or a failed start, undefined while running. */
  readonly exitCode: number | null | undefined;
  /** Why the process could not be started, if it could not. */
  readonly startError: Error | undefined;
  readonly exited: Promise<void>;
  /** Waits up to `milliseconds` for the process to have gone; true once it has. */
  settle(milliseconds: number): Promise<boolean>;
  /** Stops the process and waits for it to exit, forcibly if it will not. */
  stop(): Promise<void>;
}

type ProcessLike = Pick<ChildProcess, 'kill' | 'once'> & Partial<Pick<ChildProcess, 'pid'>>;

/** Whether the OS still runs `pid`: signal 0 tests for the process without touching it. */
function processGone(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

export function ownProcess(child: ProcessLike, label: string, { graceMs = 5000, terminate, gone }: {
  graceMs?: number;
  /** Forces the process to stop; defaults to signalling it. See `terminateTree`. */
  terminate?: (signal?: NodeJS.Signals) => void;
  /** Asks the OS whether the process has gone; defaults to probing its pid. */
  gone?: () => boolean;
} = {}): OwnedProcess {
  const end = terminate ?? ((signal?: NodeJS.Signals) => { child.kill(signal); });
  const ended = gone ?? (() => processGone(child.pid));
  let exitCode: number | null | undefined;
  let startError: Error | undefined;
  let finish!: () => void;
  const exited = new Promise<void>(done => { finish = done; });
  child.once('exit', (code: number | null) => { exitCode = code; finish(); });
  // A process that fails to spawn emits 'error' and never 'exit'.
  child.once('error', (error: Error) => { startError = error; exitCode ??= null; finish(); });
  const running = () => exitCode === undefined;
  /*
   * Its exit event, or the OS saying it has gone: on Windows Bun reported Chrome's exit well
   * after taskkill had ended it and nothing was left, and a stopped browser was counted as one
   * that would not die (round 21, TECH-064).
   */
  const settle = async (milliseconds: number) => {
    const deadline = performance.now() + milliseconds;
    while (running() && !ended() && performance.now() < deadline) {
      await Promise.race([exited, delay(100)]);
    }
    return !running() || ended();
  };
  return {
    label,
    get exitCode() { return exitCode; },
    get startError() { return startError; },
    exited,
    settle,
    async stop() {
      if (!running() || ended()) return;
      end();
      if (await settle(graceMs)) return;
      end('SIGKILL');
      if (!await settle(graceMs)) throw new Error(`${label} did not exit`);
    },
  };
}

/**
 * Stops a process and everything it started. On Windows a signal ends only the
 * process it is sent to: Chrome's renderer, GPU and utility processes outlived
 * it, held its profile, and shared the machine with the next sample (round 20,
 * TECH-064). They are ended by the owned process's id, never by name.
 */
export function terminateTree(
  child: Pick<ChildProcess, 'kill' | 'pid'>,
  { platform = process.platform, run }: {
    platform?: NodeJS.Platform;
    run?: (command: string, args: string[]) => void;
  } = {},
): (signal?: NodeJS.Signals) => void {
  return signal => {
    if (platform !== 'win32' || child.pid === undefined || !run) {
      child.kill(signal);
      return;
    }
    run('taskkill', ['/PID', String(child.pid), '/T', '/F']);
  };
}

/** Fails when something already listens on the port, before anything is started. */
export function assertPortFree(port: number, host = '127.0.0.1'): Promise<void> {
  return new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', (error: NodeJS.ErrnoException) => {
      fail(error.code === 'EADDRINUSE'
        ? new Error(`Port ${port} is already in use; stop that server or pass --port`)
        : error);
    });
    probe.listen(port, host, () => probe.close(() => done()));
  });
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; text(): Promise<string> }>;

/**
 * Waits for the owned preview to serve this build's index.html. A server that
 * answers with anything else is not ours, and neither is one that answers
 * after our preview has exited.
 */
export async function awaitOwnedPreview(
  preview: Pick<OwnedProcess, 'exitCode' | 'startError' | 'label'>,
  origin: string,
  expectedIndex: string,
  { timeoutMs = 30_000, fetch: get = fetch as FetchLike }: { timeoutMs?: number; fetch?: FetchLike } = {},
): Promise<void> {
  await until(async () => {
    if (preview.exitCode !== undefined) {
      const reason = preview.startError?.message ?? `code ${preview.exitCode}`;
      throw new Error(`${preview.label} exited (${reason}) before serving ${origin}`);
    }
    const response = await get(`${origin}/`, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!response?.ok) return null;
    const body = await response.text();
    if (body !== expectedIndex) throw new Error(`${origin} is serving something other than this build's dist/index.html`);
    return true;
  }, { timeoutMs, label: `${preview.label} on ${origin}` });
}

export interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'close' | 'error', listener: () => void): void;
}

type EventListener = (params: Record<string, unknown>, sessionId: string | undefined) => void;

export interface Cdp {
  send<T = Record<string, unknown>>(
    method: string, params?: Record<string, unknown>, options?: { sessionId?: string; timeoutMs?: number },
  ): Promise<T>;
  /** Subscribes to a protocol event; returns the unsubscribe. */
  on(method: string, listener: EventListener): () => void;
  close(): void;
}

/**
 * A DevTools protocol client with a deadline on every request. Requests still
 * waiting when the connection closes or fails are rejected with that reason.
 */
export function createCdp(socket: SocketLike, { timeoutMs = 30_000 } = {}): Cdp {
  const pending = new Map<number, { method: string; done: (value: unknown) => void; fail: (error: Error) => void }>();
  const listeners = new Map<string, Set<EventListener>>();
  let sequence = 0;
  let broken: Error | null = null;
  const abandon = (error: Error) => {
    broken ??= error;
    for (const task of pending.values()) task.fail(new Error(`${task.method}: ${error.message}`));
    pending.clear();
  };
  socket.addEventListener('message', ({ data }) => {
    const incoming = JSON.parse(String(data)) as {
      id?: number; method?: string; params?: Record<string, unknown>; sessionId?: string;
      result?: unknown; error?: { message: string };
    };
    if (incoming.id !== undefined) {
      const task = pending.get(incoming.id);
      if (!task) return;
      pending.delete(incoming.id);
      if (incoming.error) task.fail(new Error(`${task.method}: ${incoming.error.message}`));
      else task.done(incoming.result ?? {});
      return;
    }
    if (!incoming.method) return;
    for (const listener of listeners.get(incoming.method) ?? []) listener(incoming.params ?? {}, incoming.sessionId);
  });
  socket.addEventListener('close', () => abandon(new Error('DevTools connection closed')));
  socket.addEventListener('error', () => abandon(new Error('DevTools connection failed')));

  return {
    send<T>(method: string, params: Record<string, unknown> = {}, options: { sessionId?: string; timeoutMs?: number } = {}) {
      if (broken) return Promise.reject(new Error(`${method}: ${broken.message}`));
      const id = ++sequence;
      const request = new Promise<T>((done, fail) => {
        pending.set(id, { method, done: done as (value: unknown) => void, fail });
        socket.send(JSON.stringify({ id, method, params, ...(options.sessionId ? { sessionId: options.sessionId } : {}) }));
      });
      return withTimeout(request, options.timeoutMs ?? timeoutMs, method).finally(() => pending.delete(id));
    },
    on(method, listener) {
      const set = listeners.get(method) ?? new Set<EventListener>();
      listeners.set(method, set);
      set.add(listener);
      return () => { set.delete(listener); };
    },
    close() {
      abandon(new Error('DevTools connection closed by the harness'));
      socket.close();
    },
  };
}

/** Opens a WebSocket to `endpoint`, or fails within the deadline. */
export async function openSocket(endpoint: string, timeoutMs = 10_000): Promise<WebSocket> {
  const socket = new WebSocket(endpoint);
  try {
    await withTimeout(new Promise<void>((done, fail) => {
      socket.addEventListener('open', () => done());
      socket.addEventListener('error', () => fail(new Error(`Could not connect to ${endpoint}`)));
      socket.addEventListener('close', () => fail(new Error(`${endpoint} closed before opening`)));
    }), timeoutMs, `connecting to ${endpoint}`);
    return socket;
  } catch (error) {
    socket.close();
    throw error;
  }
}
