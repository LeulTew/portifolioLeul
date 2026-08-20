import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { About } from "./About";
import { cvData } from "../../../data/cv";

// Mock framer-motion useScroll & useSpring
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useScroll: () => ({
      scrollYProgress: { get: () => 0.5 },
    }),
    useSpring: (val: unknown) => val,
    useTransform: () => 0,
  };
});

describe("About Section", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders about me header, bio content, stats and tags", () => {
    render(<About />);
    const section = document.getElementById("about");
    expect(section).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /About Me/i })).toBeInTheDocument();
    expect(screen.getByText(cvData.about.title)).toBeInTheDocument();

    cvData.about.stats.forEach((stat) => {
      expect(screen.getByText(stat.value)).toBeInTheDocument();
      expect(screen.getByText(stat.label)).toBeInTheDocument();
    });

    cvData.about.highlights.forEach((highlight) => {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    });
  });

  it("renders education cards in the right-aligned layout", () => {
    render(<About />);
    expect(screen.getByLabelText("Education")).toBeInTheDocument();
    expect(screen.getByText(/HiLCoE School of Computer Science/i)).toBeInTheDocument();
    expect(screen.getByText(/Saint Joseph School/i)).toBeInTheDocument();
  });

  it("renders certifications cards cleanly", () => {
    render(<About />);
    expect(screen.getByLabelText("Certifications")).toBeInTheDocument();
    expect(screen.getByText(/Bootdev/i)).toBeInTheDocument();
  });
});
