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
    // The statements only. The ground and the field are meant to be on here:
    // they are what stays continuous across the handover.
    for (const name of ['one', 'two']) {
      const layer = STATEMENT_LAYERS.find((l) => l.name === name)!;
      expect(windowPresence(0.5, layer.start, layer.end, 0.09)).toBe(0);
    }
  });

  it('keeps the ground up for the whole stretch it is held for', () => {
    const ground = STATEMENT_LAYERS.find((l) => l.name === 'ground')!;
    expect(windowPresence(0.5, ground.start, ground.end, ground.feather!)).toBe(1);
    // Ramped in at the start, and stays fully opaque at the end to hand over to Education
    expect(windowPresence(0.02, ground.start, ground.end, ground.feather!)).toBeLessThan(1);
    expect(windowPresence(0.98, ground.start, ground.end, ground.feather!)).toBe(1);
  });

  it('clears the geometry before the stretch ends', () => {
    // Something still drifting at the handover reads as scenery left behind.
    const field = STATEMENT_LAYERS.find((l) => l.name === 'field')!;
    expect(windowPresence(0.97, field.start, field.end, field.feather!)).toBe(0);
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

  it('keeps the heading up for the whole stretch once it has arrived', () => {
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    for (const at of [0.25, 0.5, 0.85]) {
      expect(windowPresence(at, head.start, head.end, head.feather!)).toBe(1);
    }
  });

  it('has the heading up while the arrow is still pointing at it', () => {
    /*
     * The composition the whole handover exists to produce: the head of the
     * line the hero draws comes to rest just above this heading as the panel
     * reaches the top of the window, and that only exists if the heading is
     * there while the mark still is.
     *
     * This used to assert the opposite -- that the heading waited until the
     * arrow had finished leading -- which put it at full strength some four
     * hundred pixels of scroll later, by which point the mark had been carried
     * off the top and the heading arrived into an empty screen, pointed at by
     * nothing.
     */
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    expect(head.start).toBe(0);

    // Up, or well on its way, within a fraction of the stretch.
    expect(windowPresence(0.02, head.start, head.end, head.feather!)).toBeGreaterThan(0);
    expect(windowPresence(0.05, head.start, head.end, head.feather!)).toBe(1);
  });

  it('brings the copy in after the heading, not under it', () => {
    // The reader is handed from the mark to the heading to the copy, in that
    // order. The first statement used to start before the heading had arrived.
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    const one = STATEMENT_LAYERS.find((l) => l.name === 'one')!;

    expect(one.start).toBeGreaterThan(head.start + head.feather!);
    expect(windowPresence(one.start, head.start, head.end, head.feather!)).toBe(1);
  });

  it('lets the heading go only at the very end', () => {
    const head = STATEMENT_LAYERS.find((l) => l.name === 'head')!;
    expect(windowPresence(0.99, head.start, head.end, head.feather!)).toBeLessThan(1);
  });

  it('still names the section exactly once', () => {
    render(<About />);
    expect(screen.getAllByText('About Me')).toHaveLength(1);
  });
});

describe('About sequence pacing', () => {
  const layer = (name: string) =>
    STATEMENT_LAYERS.find((l) => l.name === name)!;

  it('starts the first statement as the arrow leaves, not before', () => {
    /*
     * Scroll spent on an empty held screen reads as the section failing to
     * begin, so this stays early -- but not so early that the copy arrives
     * under a heading that has not landed and a mark still pointing at it. The
     * reader is handed from the mark to the heading to the copy.
     */
    expect(layer('one').start).toBeGreaterThan(layer('head').feather!);
    expect(layer('one').start).toBeLessThan(0.12);
  });

  it('leaves no dead scroll at the end and triggers background transition after statement two', () => {
    // Statement two finishes and disappears before the background transition begins,
    // which then carries the sequence to 1.0 with no dead scroll.
    expect(layer('two').end).toBeLessThanOrEqual(layer('bgTransition').start);
    expect(layer('bgTransition').end).toBe(1.0);
  });

  it('renders the background pixel transition inside the held ground', () => {
    render(<About />);
    const bgTransition = screen.getByTestId('bg-pixel-transition');
    expect(bgTransition).toBeInTheDocument();
    const overlay = screen.getByTestId('about-sequence-overlay');
    expect(overlay).toContainElement(bgTransition);
  });

  it('spends no more scroll than the two statements need', () => {
    expect(ABOUT_SCREENS).toBeLessThanOrEqual(3);
  });
});
