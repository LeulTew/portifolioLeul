import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { precompileWorld } from './precompileWorld';

/** A renderer that records what each compile was asked under, and each program's first use. */
function renderer(programs = 3) {
  let target: THREE.WebGLRenderTarget | null = null;
  const events: string[] = [];
  const made = Array.from({ length: programs }, (_, index) => ({
    getUniforms: vi.fn(() => events.push(`uniforms ${index}`)),
    getAttributes: vi.fn(() => events.push(`attributes ${index}`)),
  }));
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (next: THREE.WebGLRenderTarget | null) => { target = next; },
    compileAsync: vi.fn(async () => { events.push(target ? 'compile target' : 'compile canvas'); }),
    info: { programs: made },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, events, made, target: () => target };
}

describe('precompileWorld (round 31)', () => {
  it('compiles for the canvas and a render target, then makes every program\'s first use', async () => {
    const { gl, events, target } = renderer();
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    await precompileWorld(gl, new THREE.Scene(), new THREE.PerspectiveCamera(), async () => {});
    expect(events).toEqual([
      'compile canvas', 'compile target',
      'uniforms 0', 'attributes 0', 'uniforms 1', 'attributes 1', 'uniforms 2', 'attributes 2',
    ]);
    // The target was only needed while asking; the renderer draws where it did before.
    expect(target()).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    dispose.mockRestore();
  });

  it('gives the page a task between one program\'s first use and the next', async () => {
    const { gl, made } = renderer();
    const turns: (() => void)[] = [];
    const done = precompileWorld(gl, new THREE.Scene(), new THREE.PerspectiveCamera(),
      () => new Promise(resolve => turns.push(resolve)));
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(made.map(program => program.getUniforms.mock.calls.length)).toEqual([0, 0, 0]);
    turns.shift()!();
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    expect(made.map(program => program.getUniforms.mock.calls.length)).toEqual([1, 0, 0]);
    turns.shift()!();
    await vi.waitFor(() => expect(turns).toHaveLength(1));
    turns.shift()!();
    await done;
    expect(made.map(program => program.getUniforms.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('restores the renderer\'s own target and releases its own even when asking under it throws', async () => {
    const { gl, target } = renderer(0);
    const dispose = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose');
    const failing = vi.mocked(gl.compileAsync);
    failing.mockImplementationOnce(async () => gl as unknown as THREE.Object3D)
      .mockImplementationOnce(() => { throw new Error('context lost'); });
    await expect(precompileWorld(gl, new THREE.Scene(), new THREE.PerspectiveCamera(), async () => {}))
      .rejects.toThrow('context lost');
    expect(target()).toBeNull();
    expect(dispose).toHaveBeenCalledOnce();
    dispose.mockRestore();
  });
});
