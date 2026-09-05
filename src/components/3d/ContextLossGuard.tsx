import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Watches the canvas for a lost GL context, and gives up gracefully if it
 * never comes back.
 *
 * A lost context is not an exception. Nothing throws, no render call fails
 * loudly, and the error boundary around the Canvas never hears about it --
 * the page simply stops drawing. Because every section here lives inside
 * drei's `Scroll html`, the reader keeps the entire site as DOM and loses
 * only the world behind it: a portfolio with its backdrop missing, and no
 * indication anything went wrong.
 *
 * Firefox reaches that state on its own. It allows eight live contexts per
 * principal and, past that, loses the least recently used one -- here the
 * backdrop, created first -- rather than refusing the newcomer. Its restore
 * path is unreliable besides. Chrome allows sixteen and restores what it
 * evicts, which is why the backdrop only ever went missing in Firefox.
 *
 * Calling `preventDefault` on the loss event is what makes a restore possible
 * at all; without it the browser will not offer one.
 *
 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1455507
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost
 */

/**
 * How long a lost context is given to come back before the page stops waiting.
 *
 * Long enough for a real restore -- a driver reset or a compositor hiccup
 * settles well inside this -- and short enough that a reader is not left
 * staring at an empty backdrop wondering whether it is still loading.
 */
export const RESTORE_GRACE_MS = 4000;

export interface ContextLossGuardProps {
  /**
   * Called when the context is gone and did not return. The page is expected
   * to take the 3D layer down and render its sections flat, which is the same
   * thing it does for a browser that never offered a context in the first
   * place.
   */
  onUnrecoverable: () => void;
}

export function ContextLossGuard({ onUnrecoverable }: ContextLossGuardProps) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let deadline: ReturnType<typeof setTimeout> | null = null;

    const clearDeadline = () => {
      if (deadline === null) return;
      clearTimeout(deadline);
      deadline = null;
    };

    const handleLost = (event: Event) => {
      // Without this the browser will never offer the context back.
      event.preventDefault();
      console.warn('WebGL context lost; waiting for the browser to restore it.');
      clearDeadline();
      deadline = setTimeout(onUnrecoverable, RESTORE_GRACE_MS);
    };

    const handleRestored = () => {
      clearDeadline();
    };

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    /*
     * The context can already be gone by the time this mounts -- Firefox
     * evicts on creation of the ninth context, which may be this canvas's own
     * neighbour a frame earlier.
     */
    if (gl.getContext().isContextLost()) {
      deadline = setTimeout(onUnrecoverable, RESTORE_GRACE_MS);
    }

    return () => {
      clearDeadline();
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onUnrecoverable]);

  return null;
}
