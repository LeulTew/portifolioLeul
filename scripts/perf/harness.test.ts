import { EventEmitter } from 'node:events';
import { createServer, type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Scope, assertPortFree, awaitOwnedPreview, createCdp, ownProcess, scoped, until, withTimeout, type SocketLike,
} from './harness';

afterEach(() => { vi.useRealTimers(); });

describe('deadlines', () => {
  it('names what timed out', async () => {
    await expect(withTimeout(new Promise(() => {}), 20, 'Page.navigate')).rejects.toThrow('Page.navigate');
    await expect(withTimeout(Promise.resolve(7), 20, 'quick')).resolves.toBe(7);
  });

  it('waits for a value, stops at the first error, and bounds a check that hangs', async () => {
    let calls = 0;
    await expect(until(() => ++calls === 3 && 'ready', { timeoutMs: 1000, label: 'ready', intervalMs: 1 })).resolves.toBe('ready');
    await expect(until(() => { throw new Error('preview exited'); }, { timeoutMs: 1000, label: 'x' }))
      .rejects.toThrow('preview exited');
    const started = Date.now();
    await expect(until(() => new Promise(() => {}), { timeoutMs: 60, label: 'a hung evaluate' }))
      .rejects.toThrow('a hung evaluate');
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(until(() => null, { timeoutMs: 30, label: 'nothing', intervalMs: 5 })).rejects.toThrow('nothing');
  });
});

describe('resource scope', () => {
  it('releases last-in first-out, once, and keeps going past a failed release', async () => {
    const order: string[] = [];
    const scope = new Scope();
    scope.defer('profile', () => { order.push('profile'); });
    scope.defer('chrome', () => { order.push('chrome'); throw new Error('still running'); });
    scope.defer('socket', async () => { order.push('socket'); });
    const [first, second] = await Promise.all([scope.close(), scope.close()]);
    expect(order).toEqual(['socket', 'chrome', 'profile']);
    expect(first).toBe(second);
    expect(first.map(error => error.message)).toEqual(['chrome: still running']);
  });

  it('releases at once what it is handed after closing', async () => {
    const scope = new Scope();
    await scope.close();
    const release = vi.fn();
    scope.defer('late', release);
    await Promise.resolve();
    expect(release).toHaveBeenCalledOnce();
  });

  it('closes a child scope however its work ends and hands its cleanup errors back', async () => {
    // Round 9 (TECH-023): a cold sample's Chrome that would not close was only logged.
    const parent = new Scope();
    const kept = await scoped(parent, 'sample 1', async own => {
      own.defer('chrome', () => { throw new Error('still running'); });
      return 7;
    });
    expect(kept.outcome).toEqual({ status: 'fulfilled', value: 7 });
    expect(kept.cleanup.map(error => error.message)).toEqual(['chrome: still running']);

    const profile = vi.fn();
    const failed = await scoped(parent, 'sample 2', async own => {
      own.defer('profile', profile);
      throw new Error('navigation failed');
    });
    expect(failed.outcome).toMatchObject({ status: 'rejected', reason: new Error('navigation failed') });
    expect(failed.cleanup).toEqual([]);
    expect(profile).toHaveBeenCalledOnce();
    // Closing the parent later releases nothing twice.
    await expect(parent.close()).resolves.toEqual([]);
    expect(profile).toHaveBeenCalledOnce();
  });

  it('lets an interrupted run close a child scope that is still working', async () => {
    const parent = new Scope();
    const chrome = vi.fn();
    let started!: () => void;
    const running = new Promise<void>(resolve => { started = resolve; });
    void scoped(parent, 'sample 1', async own => {
      own.defer('chrome', chrome);
      started();
      await new Promise(() => {});
    });
    await running;
    await parent.close();
    expect(chrome).toHaveBeenCalledOnce();
  });
});

class FakeChild extends EventEmitter {
  signals: (string | undefined)[] = [];
  constructor(private readonly obeys: string[]) { super(); }
  kill(signal?: NodeJS.Signals) {
    this.signals.push(signal);
    if (this.obeys.includes(signal ?? 'SIGTERM')) queueMicrotask(() => this.emit('exit', null));
    return true;
  }
}

describe('owned processes', () => {
  it('stops a process and waits for it to exit', async () => {
    const child = new FakeChild(['SIGTERM']);
    const owned = ownProcess(child as never, 'vite preview');
    expect(owned.exitCode).toBeUndefined();
    await owned.stop();
    expect(child.signals).toEqual([undefined]);
    expect(owned.exitCode).toBeNull();
    await owned.stop();
    expect(child.signals).toHaveLength(1);
  });

  it('kills one that ignores the request, and reports one that will not die', async () => {
    const stubborn = new FakeChild(['SIGKILL']);
    await ownProcess(stubborn as never, 'Chrome', { graceMs: 10 }).stop();
    expect(stubborn.signals).toEqual([undefined, 'SIGKILL']);
    await expect(ownProcess(new FakeChild([]) as never, 'Chrome', { graceMs: 10 }).stop()).rejects.toThrow('Chrome did not exit');
  });

  it('records a process that could not start', () => {
    const child = new FakeChild([]);
    const owned = ownProcess(child as never, 'Chrome');
    child.emit('error', new Error('spawn chrome ENOENT'));
    expect(owned.exitCode).toBeNull();
    expect(owned.startError?.message).toContain('ENOENT');
  });
});

describe('the owned preview', () => {
  it('refuses a port something already listens on, before starting anything', async () => {
    const other = createServer();
    await new Promise<void>(done => other.listen(0, '127.0.0.1', () => done()));
    const { port } = other.address() as AddressInfo;
    await expect(assertPortFree(port)).rejects.toThrow(`Port ${port} is already in use`);
    await new Promise(done => other.close(done));
    await expect(assertPortFree(port)).resolves.toBeUndefined();
  });

  const running = { label: 'vite preview', exitCode: undefined, startError: undefined };
  const serving = (body: string) => vi.fn(async () => ({ ok: true, text: async () => body }));

  it('accepts only a server serving this build', async () => {
    await expect(awaitOwnedPreview(running, 'http://127.0.0.1:4319', '<html>build</html>',
      { fetch: serving('<html>build</html>') })).resolves.toBeUndefined();
    await expect(awaitOwnedPreview(running, 'http://127.0.0.1:4319', '<html>build</html>',
      { fetch: serving('<html>another app</html>') })).rejects.toThrow("something other than this build's dist/index.html");
  });

  it('does not mistake another server for a preview that has exited', async () => {
    const exited = { label: 'vite preview', exitCode: 1, startError: undefined };
    const fetch = serving('<html>build</html>');
    await expect(awaitOwnedPreview(exited, 'http://127.0.0.1:4319', '<html>build</html>', { fetch }))
      .rejects.toThrow('vite preview exited (code 1)');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives up on a preview that never answers', async () => {
    const refused = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    await expect(awaitOwnedPreview(running, 'http://127.0.0.1:4319', 'x', { fetch: refused, timeoutMs: 50 }))
      .rejects.toThrow('Timed out');
  });
});

class FakeSocket implements SocketLike {
  sent: { id: number; method: string; sessionId?: string }[] = [];
  closed = false;
  private readonly listeners: Record<string, ((event: { data: unknown }) => void)[]> = {};
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; }
  addEventListener(type: string, listener: (event: { data: unknown }) => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  emit(type: string, data?: unknown) { for (const listener of this.listeners[type] ?? []) listener({ data: JSON.stringify(data) }); }
}

describe('DevTools client', () => {
  it('matches replies to requests and rejects protocol errors by method', async () => {
    const socket = new FakeSocket();
    const cdp = createCdp(socket);
    const version = cdp.send('Browser.getVersion');
    const navigate = cdp.send('Page.navigate', { url: 'x' }, { sessionId: 'page' });
    expect(socket.sent[1]).toMatchObject({ method: 'Page.navigate', sessionId: 'page' });
    socket.emit('message', { id: 2, error: { message: 'Cannot navigate to invalid URL' } });
    socket.emit('message', { id: 1, result: { product: 'Chrome/153' } });
    await expect(version).resolves.toEqual({ product: 'Chrome/153' });
    await expect(navigate).rejects.toThrow('Page.navigate: Cannot navigate to invalid URL');
  });

  it('gives every request a deadline', async () => {
    const cdp = createCdp(new FakeSocket(), { timeoutMs: 20 });
    await expect(cdp.send('Runtime.evaluate')).rejects.toThrow('Runtime.evaluate');
  });

  it('fails waiting and later requests when the connection drops', async () => {
    const socket = new FakeSocket();
    const cdp = createCdp(socket);
    const waiting = cdp.send('Runtime.evaluate');
    socket.emit('close');
    await expect(waiting).rejects.toThrow('Runtime.evaluate: DevTools connection closed');
    await expect(cdp.send('Page.navigate')).rejects.toThrow('DevTools connection closed');
  });

  it('delivers events with their session', () => {
    const socket = new FakeSocket();
    const cdp = createCdp(socket);
    const events: unknown[] = [];
    const off = cdp.on('Runtime.exceptionThrown', (params, session) => events.push([params, session]));
    socket.emit('message', { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'boom' } }, sessionId: 'page' });
    off();
    socket.emit('message', { method: 'Runtime.exceptionThrown', params: {}, sessionId: 'page' });
    expect(events).toEqual([[{ exceptionDetails: { text: 'boom' } }, 'page']]);
  });
});
