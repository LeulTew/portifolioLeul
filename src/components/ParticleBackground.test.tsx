/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ParticleBackground from "./ParticleBackground";

vi.mock("@react-three/fiber", () => ({
  useFrame: (callback: (state: any) => void) => {
    callback({
      clock: { elapsedTime: 2.0 },
    });
  },
}));

describe("ParticleBackground Component", () => {
  it("renders dark theme particles without crashing", () => {
    const { container } = render(<ParticleBackground theme="dark" />);
    expect(container).toBeDefined();
  });

  it("renders light theme particles without crashing", () => {
    const { container } = render(<ParticleBackground theme="light" />);
    expect(container).toBeDefined();
  });
});
