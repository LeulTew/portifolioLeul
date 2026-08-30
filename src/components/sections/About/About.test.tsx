import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { About } from "./About";
import { STATEMENT_LAYERS } from "./statementLayers";
import { windowPresence, layerOpacity } from "@/lib/motion/sequenceWindow";
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

describe('About held sequence', () => {
  it('spends real scroll being held, rather than passing by', () => {
    render(<About />);
    const spacer = screen.getByTestId('about-sequence');
    expect(Number.parseFloat(spacer.style.height)).toBeGreaterThanOrEqual(200);
  });

  it('puts both statements on the one held background', () => {
    // Not a stage each: the background is the only thing continuous across
    // the handover, which is what makes the reader feel held rather than
    // carried past two panels.
    render(<About />);
    const overlay = screen.getByTestId('about-sequence-overlay');
    expect(overlay).toContainElement(screen.getByTestId('about-left-column'));
    expect(overlay).toContainElement(screen.getByTestId('about-right-column'));
  });

  it('holds the background for the whole stretch, not per statement', () => {
    render(<About />);
    const plates = screen.getAllByTestId('parallax-plate');
    expect(plates.length).toBeGreaterThan(0);
    const overlay = screen.getByTestId('about-sequence-overlay');
    for (const plate of plates) {
      expect(overlay).toContainElement(plate);
    }
  });

  it('hands over rather than crossfading: neither is on at the changeover', () => {
    for (const layer of STATEMENT_LAYERS) {
      expect(windowPresence(0.5, layer.start, layer.end, 0.09)).toBe(0);
    }
  });

  it('starts each statement from nothing, not from a blurred ghost', () => {
    // A fifth of the way in must be invisible, not a large soft copy of the
    // text sitting on screen for the whole approach.
    const first = STATEMENT_LAYERS[0];
    const early = windowPresence(first.start + 0.02, first.start, first.end, 0.09);
    expect(early).toBeGreaterThan(0);
    expect(layerOpacity(early)).toBeLessThan(0.05);
  });
});

describe('About statement alignment', () => {
  it('keeps each statement on the side it is written for', () => {
    // Centring both horizontally threw away the left/right composition the
    // pair is written as.
    render(<About />);
    expect(screen.getByTestId('about-left-column').className).toContain(
      'leftColumn'
    );
    expect(screen.getByTestId('about-right-column').className).toContain(
      'rightColumn'
    );
  });
});
