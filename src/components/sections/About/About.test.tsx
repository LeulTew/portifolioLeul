import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { About } from "./About";
import { STATEMENT_LAYERS, ABOUT_SCREENS } from "./statementLayers";
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
    // The statements only. The ground and the field are meant to be on here:
    // they are what stays continuous across the handover.
    for (const name of ['one', 'two']) {
      const layer = STATEMENT_LAYERS.find((l) => l.name === name)!;
      expect(windowPresence(0.5, layer.start, layer.end, 0.09)).toBe(0);
    }
  });

  it('keeps the ground up for the whole stretch it is held for', () => {
    const ground = STATEMENT_LAYERS.find((l) => l.name === 'ground')!;
    expect(windowPresence(0.5, ground.start, ground.end, ground.feather)).toBe(1);
    // Ramped at both ends, so the world is handed back rather than switched on.
    expect(windowPresence(0.02, ground.start, ground.end, ground.feather)).toBeLessThan(1);
    expect(windowPresence(0.98, ground.start, ground.end, ground.feather)).toBeLessThan(1);
  });

  it('clears the geometry before the stretch ends', () => {
    // Something still drifting at the handover reads as scenery left behind.
    const field = STATEMENT_LAYERS.find((l) => l.name === 'field')!;
    expect(windowPresence(0.97, field.start, field.end, field.feather)).toBe(0);
  });

  it('starts each statement from nothing, not from a blurred ghost', () => {
    // A fifth of the way in must be invisible, not a large soft copy of the
    // text sitting on screen for the whole approach.
    const first = STATEMENT_LAYERS.find((l) => l.name === 'one')!;
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

describe('About held heading', () => {
  it('holds the heading with the rest, not in the flow above it', () => {
    // A heading left in the flow climbs away while the reader is held still
    // underneath it: the one thing naming the section leaves as it begins.
    render(<About />);
    expect(screen.getByTestId('about-sequence-overlay')).toContainElement(
      screen.getByTestId('about-held-header')
    );
  });

  it('keeps the heading up for the whole stretch', () => {
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    for (const at of [0.15, 0.5, 0.85]) {
      expect(windowPresence(at, head.start, head.end, head.feather)).toBe(1);
    }
  });

  it('lets the heading go only at the very ends', () => {
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    expect(windowPresence(0.01, head.start, head.end, head.feather)).toBeLessThan(1);
    expect(windowPresence(0.99, head.start, head.end, head.feather)).toBeLessThan(1);
  });

  it('still names the section exactly once', () => {
    render(<About />);
    expect(screen.getAllByText('About Me')).toHaveLength(1);
  });
});

describe('About sequence pacing', () => {
  const layer = (name: string) =>
    STATEMENT_LAYERS.find((l) => l.name === name)!;

  it('starts the first statement almost as soon as the reader is held', () => {
    // Scroll spent on an empty held screen reads as the section failing to
    // begin.
    expect(layer('one').start).toBeLessThan(0.06);
  });

  it('leaves no dead scroll at the end', () => {
    // Nothing to look at while still being held is the same fault at the
    // other end.
    expect(layer('two').end).toBeGreaterThan(0.95);
  });

  it('spends no more scroll than the two statements need', () => {
    expect(ABOUT_SCREENS).toBeLessThanOrEqual(3);
  });
});
