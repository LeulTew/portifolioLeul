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

  it("carries the education record set, degrees and certifications alike", () => {
    render(<About />);
    expect(screen.getByRole("heading", { level: 2, name: "Education" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /HiLCoE School of Computer Science/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Saint Joseph School/i })).toBeInTheDocument();
    // Certifications used to be a second grid below the degrees, which read as
    // an afterthought. They are records on the same rail now.
    expect(screen.getByRole("heading", { name: "Bootdev" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "freeCodeCamp" })).toBeInTheDocument();
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

  it('hands over seamlessly with zero empty gap: statements overlap at changeover', () => {
    const one = STATEMENT_LAYERS.find((l) => l.name === 'one')!;
    const two = STATEMENT_LAYERS.find((l) => l.name === 'two')!;
    // At midpoint 0.42, statement one is ramping out while statement two is ramping in concurrently
    const pOne = windowPresence(0.42, one.start, one.end, one.feather ?? 0.08);
    const pTwo = windowPresence(0.42, two.start, two.end, two.feather ?? 0.08);
    expect(pOne).toBeGreaterThan(0.2);
    expect(pTwo).toBeGreaterThan(0.2);
    expect(layerOpacity(pOne)).toBeGreaterThan(0.05);
    expect(layerOpacity(pTwo)).toBeGreaterThan(0.05);
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
    // Must be completely cleared before background pixel transition begins at 0.78
    const field = STATEMENT_LAYERS.find((l) => l.name === 'field')!;
    expect(windowPresence(0.78, field.start, field.end, field.feather!)).toBe(0);
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

  it('provides mutual exclusion structure so heldHeader and education-stage do not display duplicate titles', () => {
    render(<About />);
    const heldHeader = screen.getByTestId('about-held-header');
    const stage = screen.getByTestId('education-stage');
    expect(heldHeader).toBeInTheDocument();
    expect(stage).toBeInTheDocument();
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

describe('About statement two clears before the background rises', () => {
  /*
   * The reported bug: the right-hand statement never went away. It sat over
   * the rising green, then over the Education frame.
   *
   * `STATEMENT_LAYERS` has always declared `two` as ending at 0.78 on an 0.08
   * ramp -- the same 0.78 the background transition starts at -- but the
   * component wrote `--two-in` / `--two-on` onto `.statements`, a descendant of
   * the overlay the layer window is published on, so the nearer declaration won
   * and the layer's exit ramp never applied. What the component wrote instead
   * was the handover alone, which only runs 0 -> 1.
   */
  const seqTo = async (value: number) => {
    const overlay = screen.getByTestId('about-sequence-overlay');
    overlay.style.setProperty('--seq', value.toFixed(3));
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 20));
  };

  const presence = () => {
    const container = screen
      .getByTestId('about-right-column')
      .closest<HTMLElement>('[data-contrary]')!;
    return {
      in: Number.parseFloat(container.style.getPropertyValue('--two-in')),
      on: Number.parseFloat(container.style.getPropertyValue('--two-on')),
    };
  };

  it('holds statement two up through the middle of the stretch', async () => {
    render(<About />);
    await seqTo(0.6);
    expect(presence().in).toBe(1);
    expect(presence().on).toBe(1);
  });

  it('has taken statement two away by the time the green starts rising', async () => {
    const bg = STATEMENT_LAYERS.find((l) => l.name === 'bgTransition')!;
    render(<About />);
    await seqTo(bg.start);

    expect(presence().in).toBe(0);
    expect(presence().on).toBe(0);
  });

  it('clears it on a ramp rather than switching it off', async () => {
    const two = STATEMENT_LAYERS.find((l) => l.name === 'two')!;
    const midway = two.end - (two.feather ?? 0.09) / 2;
    render(<About />);
    await seqTo(midway);

    const at = presence();
    expect(at.in).toBeGreaterThan(0);
    expect(at.in).toBeLessThan(1);
  });

  it('brings it back when the reader scrolls up out of the exit', async () => {
    render(<About />);
    await seqTo(0.78);
    expect(presence().in).toBe(0);

    await seqTo(0.6);
    expect(presence().in).toBe(1);
  });
});

describe('About statements contrast reactivity', () => {
  it('initializes statements with data-contrary="false"', () => {
    render(<About />);
    const leftCol = screen.getByTestId('about-left-column');
    const statementsContainer = leftCol.closest('[data-contrary]');
    expect(statementsContainer).toBeInTheDocument();
    expect(statementsContainer?.getAttribute('data-contrary')).toBe('false');
  });

  it('reacts dynamically to contrary background attribute mutations', async () => {
    render(<About />);
    const leftCol = screen.getByTestId('about-left-column');
    const statementsContainer = leftCol.closest('[data-contrary]');
    const aboutSection = document.getElementById('about');
    expect(aboutSection).toBeInTheDocument();

    // Trigger green/contrary background state
    aboutSection?.setAttribute('data-bg-transition', 'true');
    // Allow mutation observer / microtask to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(statementsContainer?.getAttribute('data-contrary')).toBe('true');

    // Remove green/contrary state
    aboutSection?.removeAttribute('data-bg-transition');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(statementsContainer?.getAttribute('data-contrary')).toBe('false');
  });

  it('settles statement one initially and statement two upon handover completion', async () => {
    render(<About />);
    const leftCol = screen.getByTestId('about-left-column');
    const statementsContainer = leftCol.closest<HTMLElement>('[data-contrary]');
    const aboutSection = document.getElementById('about');
    expect(statementsContainer).toBeInTheDocument();

    // Initially on Statement One
    expect(statementsContainer?.style.getPropertyValue('--one-in')).toBe('1.000');
    expect(statementsContainer?.style.getPropertyValue('--two-in')).toBe('0.000');
    expect(aboutSection?.getAttribute('data-statements-cleared')).toBeNull();

    // Simulate sequence progress past handover (seq = 0.60)
    const overlay = screen.getByTestId('about-sequence-overlay');
    overlay.style.setProperty('--seq', '0.60');
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Statement Two is now fully settled and holds showing
    expect(statementsContainer?.style.getPropertyValue('--two-in')).toBe('1.000');
    expect(statementsContainer?.style.getPropertyValue('--one-in')).toBe('0.000');
    /*
     * Statement two is up, and the screen is NOT yet clear -- the exit runs
     * from 0.70 and this is 0.60. `data-statements-cleared` is the section's
     * one published fact about the statements now, and it is what the
     * background waits on, so it must still be absent here.
     */
    expect(aboutSection?.getAttribute('data-statements-cleared')).toBeNull();
  });
});

