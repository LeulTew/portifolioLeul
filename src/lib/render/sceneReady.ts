/**
 * Whether the world behind the loader is actually built yet.
 *
 * Having the bytes is not the same as having the scene. Once the models have
 * downloaded they still have to be decoded into geometry, their textures
 * uploaded, and every material compiled into a shader program -- on a weak GPU
 * that last part alone is a noticeable pause. A loader that closes on the last
 * byte hands over a page whose world is still assembling itself, which is the
 * thing being reported.
 *
 * So the scene reports for itself. A component inside the Canvas registers on
 * mount and, once it has both its resources and a rendered frame, says so.
 *
 * If nothing ever registers -- no Canvas, as in a DOM test, or a browser with
 * no WebGL at all -- the loader does not wait for a signal that is never
 * coming. Only a scene that has announced itself can hold the page shut.
 */

type Listener = () => void;

let registered = false;
let ready = false;
const listeners = new Set<Listener>();

/*
 * The world is not drawn while its opening programs compile (round 31). A
 * program compiled the first time it is drawn stalls the main thread until the
 * GPU process has finished it: about a second of a throttled startup, the
 * loader frozen for all of it. Asked for up front, off the main thread, and
 * drawn once they are done, they cost the page nothing. The loader covers
 * the world meanwhile. Neither wait is allowed to outlast the loader's own.
 */
/** How long a registered world stays undrawn while its opening resources arrive. */
export const WORLD_HOLD_MS = 30_000;
/** How long compiling its programs may take before it is drawn regardless. */
export const WORLD_COMPILE_MS = 8_000;
let registeredAt = 0;
let compileStartedAt = 0;
let compiled = false;

function notify(): void {
  for (const listener of listeners) listener();
}

/** Called by the scene as it mounts, before it can possibly be ready. */
export function registerScene(): void {
  if (registered) return;
  registered = true;
  registeredAt = performance.now();
  notify();
}

/** The scene has its resources and has asked for its programs. */
export function beginWorldCompile(): void {
  compileStartedAt ||= performance.now();
}

/** Its programs are compiled, or will not be waited for: the world may be drawn. */
export function setWorldCompiled(): void {
  compiled = true;
}

/** True while a registered world waits, undrawn, for its opening programs. */
export function isWorldHeld(): boolean {
  if (!registered || compiled || ready) return false;
  const now = performance.now();
  return compileStartedAt
    ? now - compileStartedAt < WORLD_COMPILE_MS
    : now - registeredAt < WORLD_HOLD_MS;
}

/** Called once the scene has its resources and has drawn a frame. */
export function setSceneReady(): void {
  if (ready) return;
  registered = true;
  ready = true;
  notify();
}

/**
 * True when the world is up, or when there is no world waiting to come up.
 *
 * The second case is what keeps a page without a Canvas from hanging on the
 * loader forever.
 */
export function isSceneReady(): boolean {
  return ready || !registered;
}

export function subscribeSceneReady(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: forget that any scene ever mounted. */
export function resetSceneReady(): void {
  registered = false;
  ready = false;
  registeredAt = 0;
  compileStartedAt = 0;
  compiled = false;
  listeners.clear();
}
