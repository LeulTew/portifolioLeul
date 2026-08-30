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

  it("renders about me header, spatial editorial typography, stats and tags", () => {
    render(<About />);
    const section = document.getElementById("about");
    expect(section).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /About Me/i })).toBeInTheDocument();
    expect(screen.getByText(/KEEP IT SIMPLE/i)).toBeInTheDocument();
    expect(screen.getByText(/SCALABLE SYSTEMS/i)).toBeInTheDocument();
    expect(screen.getByText(/3\+/i)).toBeInTheDocument();
    expect(screen.getByText(/30\+/i)).toBeInTheDocument();

    cvData.about.highlights.forEach((highlight) => {
      expect(screen.getByText(highlight)).toBeInTheDocument();
    });
  });

  it("renders education cards in the layout", () => {
    render(<About />);
    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText(/HiLCoE School of Computer Science/i)).toBeInTheDocument();
    expect(screen.getByText(/Saint Joseph School/i)).toBeInTheDocument();
  });

  it("renders certifications cards cleanly", () => {
    render(<About />);
    expect(screen.getByText("Certifications")).toBeInTheDocument();
    expect(screen.getByText(/Bootdev/i)).toBeInTheDocument();
  });
});

describe('About column convergence', () => {
  it('draws the two columns in from opposite edges', () => {
    render(<About />);
    const left = screen.getByTestId('about-left-column');
    const right = screen.getByTestId('about-right-column');

    // jsdom reports no intersection, so both sit at their far offset. The
    // point under test is the symmetry: one comes from each side.
    const offset = (el: HTMLElement) =>
      /translate3d\((-?[\d.]+)rem/.exec(el.style.transform)?.[1];

    expect(Number(offset(left))).toBeLessThan(0);
    expect(Number(offset(right))).toBeGreaterThan(0);
    expect(Number(offset(left))).toBe(-Number(offset(right)));
  });

  it('holds them out of focus until they are on screen', () => {
    render(<About />);
    for (const id of ['about-left-column', 'about-right-column']) {
      const column = screen.getByTestId(id);
      expect(column.style.opacity).toBe('0');
      expect(column.style.filter).toContain('blur(');
    }
  });
});

describe('About stages', () => {
  it('gives each statement its own stage, so they do not arrive together', () => {
    render(<About />);
    expect(screen.getByTestId('about-stage-one')).toBeInTheDocument();
    expect(screen.getByTestId('about-stage-two')).toBeInTheDocument();
  });

  it('keeps the left statement in the first stage and the right in the second', () => {
    render(<About />);
    expect(
      screen.getByTestId('about-stage-one').contains(
        screen.getByTestId('about-left-column')
      )
    ).toBe(true);
    expect(
      screen.getByTestId('about-stage-two').contains(
        screen.getByTestId('about-right-column')
      )
    ).toBe(true);
  });

  it('fills the space each statement leaves rather than standing it empty', () => {
    render(<About />);
    const plates = screen.getAllByTestId('parallax-plate');
    expect(plates).toHaveLength(2);
    expect(screen.getByTestId('about-stage-one').contains(plates[0])).toBe(true);
    expect(screen.getByTestId('about-stage-two').contains(plates[1])).toBe(true);
  });
});
