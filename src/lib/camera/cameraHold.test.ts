import { afterEach, describe, expect, it } from 'vitest';
import { getOverlayOcclusion, resetCameraHold, setOverlayOcclusion } from './cameraHold';

afterEach(resetCameraHold);

describe('independent opaque-stage ownership', () => {
  it('does not uncover Education when the About pin releases', () => {
    setOverlayOcclusion(true, 'education');
    setOverlayOcclusion(true, 'about');
    setOverlayOcclusion(false, 'about');
    expect(getOverlayOcclusion()).toBe(true);
    setOverlayOcclusion(false, 'education');
    expect(getOverlayOcclusion()).toBe(false);
  });

  it('retains the About underlay while Education closes backwards', () => {
    setOverlayOcclusion(true, 'about');
    setOverlayOcclusion(true, 'education');
    setOverlayOcclusion(false, 'education');
    expect(getOverlayOcclusion()).toBe(true);
    resetCameraHold();
    expect(getOverlayOcclusion()).toBe(false);
  });
});
