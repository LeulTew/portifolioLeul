import * as THREE from 'three';

/**
 * Compiles every material in the scene off the main thread, then makes each
 * program's first use, and resolves once all of it is done (round 31).
 *
 * Twice: once as the canvas draws, and once as a render target does. A target
 * is drawn linear and without tone mapping, which is a different program, and
 * the water's reflection draws the whole scene into one every frame.
 *
 * A compiled program is still read back on its first use -- its uniforms and
 * attributes looked up and their setters built -- and drawn, the first frame
 * did that for all of them at once: about a second of one task, throttled.
 * Here it is one program per task, between which the page goes on.
 */
export async function precompileWorld(
  gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera,
  yieldToPage: () => Promise<void> = nextTask,
): Promise<void> {
  if (typeof gl.compileAsync !== 'function') return;
  await gl.compileAsync(scene, camera);
  const target = new THREE.WebGLRenderTarget(1, 1);
  try {
    const previous = gl.getRenderTarget();
    let reflected: Promise<unknown>;
    // Programs are chosen as they are asked for, so the target is needed only while asking.
    gl.setRenderTarget(target);
    try {
      reflected = gl.compileAsync(scene, camera);
    } finally {
      gl.setRenderTarget(previous);
    }
    await reflected;
  } finally {
    target.dispose();
  }
  for (const program of [...(gl.info.programs ?? [])]) {
    await yieldToPage();
    program.getUniforms();
    program.getAttributes();
  }
}

function nextTask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
