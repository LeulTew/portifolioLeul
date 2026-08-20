import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RotatingGear } from "./RotatingGear";

describe("RotatingGear Component", () => {
  it("renders SVG elements and telemetry label in dark mode", () => {
    render(<RotatingGear theme="dark" rotationOffset={45} />);

    expect(screen.getByText("mech.rot(45deg)")).toBeInTheDocument();
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders correctly in light mode with calibrated colors", () => {
    render(<RotatingGear theme="light" rotationOffset={90} />);

    expect(screen.getByText("mech.rot(90deg)")).toBeInTheDocument();
  });
});
