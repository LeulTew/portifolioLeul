import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  OCEAN_SIZE,
  OCEAN_NORMALS_URL,
  OCEAN_TIME_SPEED,
  getOceanSurfaceConfig,
} from "./oceanConfig";

describe("oceanConfig", () => {
  it("exports expected geometric and rendering constants", () => {
    expect(OCEAN_SIZE).toBe(1400);
    expect(OCEAN_NORMALS_URL).toBe("/images/waternormals.jpg");
    expect(OCEAN_TIME_SPEED).toBe(0.29);
  });

  it("returns calibrated ocean surface config for dark theme", () => {
    const config = getOceanSurfaceConfig("dark");
    expect(config.textureWidth).toBe(512);
    expect(config.textureHeight).toBe(512);
    expect(config.distortionScale).toBe(2.25);
    expect(config.alpha).toBe(0.95);
    expect(config.fog).toBe(true);
    expect(config.format).toBe(THREE.RGBAFormat);
    expect(config.waterColor.getHexString().toLowerCase()).toBe("04303a");
  });

  it("returns calibrated ocean surface config for light theme", () => {
    const config = getOceanSurfaceConfig("light");
    expect(config.textureWidth).toBe(512);
    expect(config.textureHeight).toBe(512);
    expect(config.distortionScale).toBe(2.8);
    expect(config.alpha).toBe(0.92);
    expect(config.fog).toBe(true);
    expect(config.format).toBe(THREE.RGBAFormat);
    expect(config.waterColor.getHexString().toLowerCase()).toBe("2f8db8");
  });
});
