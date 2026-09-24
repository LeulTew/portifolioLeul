import { describe, expect, it } from 'vitest';
import { TVScreenMaterial } from './tvScreenMaterial';

describe('broadcast-only CRT signal', () => {
  it('starts with black glass, then opens and closes on a finite visible clock', () => {
    const material = new TVScreenMaterial(true);
    material.update('off', 0, 0, 16, false, 300);
    expect(material.uniforms.uPower.value).toBe(0);
    material.update('broadcast', 0, 1, 30000, false, 300);
    expect(material.uniforms.uPower.value).toBe(50 / 640);
    for (let i = 0; i < 13; i++) material.update('broadcast', 0, 1, 50, false, 300);
    expect(material.uniforms.uPower.value).toBe(1);
    for (let i = 0; i < 8; i++) material.update('off', 0, 2, 50, false, 300);
    expect(material.uniforms.uPower.value).toBe(0);
    material.dispose();
  });

  it('keeps project text entirely outside the entertainment shader and disables its signal', () => {
    const material = new TVScreenMaterial(true);
    material.update('broadcast', 0, 1, 1000, true, 300);
    material.update('projects', 0, 1, 16, false, 300);
    expect(material.uniforms.uReader.value).toBe(1);
    expect(material.uniforms.uPower.value).toBe(0);
    expect(material.fragmentShader).toContain('if (uReader > .5)');
    material.dispose();
  });

  it('settles reduced motion and disables fine stripes on the low tier', () => {
    const material = new TVScreenMaterial(false);
    material.update('broadcast', 1, 3, 16, true, 80);
    expect(material.uniforms.uPower.value).toBe(1);
    expect(material.uniforms.uTune.value).toBe(0);
    expect(material.uniforms.uDetail.value).toBe(0);
    material.update('off', 1, 4, 16, true, 80);
    expect(material.uniforms.uPower.value).toBe(0);
    material.dispose();
  });

  it('runs the local test-card signal only while exposed and motion is allowed', () => {
    const material = new TVScreenMaterial(true);
    material.update('broadcast', 1, 1, 50, false, 300, true);
    const time = material.uniforms.uTime.value;
    expect(time).toBe(0.05);
    for (let i = 0; i < 50; i++) material.update('broadcast', 1, 1, 50, false, 300, false);
    expect(material.uniforms.uTime.value).toBe(time);
    material.update('broadcast', 1, 1, 50, true, 300, true);
    expect(material.uniforms.uTime.value).toBe(time);
    material.dispose();
  });
});
