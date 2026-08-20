import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { WireframeSphere } from "./WireframeSphere";

describe("WireframeSphere Component", () => {
  it("renders canvas and telemetry badge", () => {
    render(<WireframeSphere theme="dark" size={200} />);

    expect(screen.getByText("orb.mesh(fibonacci-650)")).toBeInTheDocument();
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders in light mode without crashing", () => {
    render(<WireframeSphere theme="light" size={150} interactive={false} />);

    expect(screen.getByText("orb.mesh(fibonacci-650)")).toBeInTheDocument();
  });
});
