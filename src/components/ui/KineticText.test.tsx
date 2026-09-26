import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  KineticHeading,
  DancingCharText,
  KineticRotator,
} from "./KineticText";
import * as animationGateway from "@/lib/gateways/animationGateway";

describe("KineticText Components", () => {
  describe("KineticHeading", () => {
    it("renders heading with custom tag and highlight words", () => {
      render(
        <KineticHeading
          text="Transforming Digital Experiences"
          highlightWords={["Digital"]}
          as="h2"
        />
      );

      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
      expect(screen.getByText("Transforming")).toBeInTheDocument();
      expect(screen.getByText("Digital")).toHaveClass("text-emerald-400");
    });

    it("defaults to h1 tag if not specified", () => {
      render(<KineticHeading text="Hero Title" />);
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  describe("DancingCharText", () => {
    it("renders individual characters for interactive dancing typography", () => {
      render(<DancingCharText text="Skills" as="h3" />);
      expect(screen.getByRole("heading", { level: 3, name: "Skills" })).toBeInTheDocument();
      expect(screen.getAllByText(/s/i)).toHaveLength(2);
    });

    it("renders spaces safely with non-breaking whitespace", () => {
      const { container } = render(<DancingCharText text="A B" />);
      expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
    });

    it("renders static spans when prefers-reduced-motion is active", () => {
      vi.spyOn(animationGateway, "getPrefersReducedMotion").mockReturnValue(true);
      render(<DancingCharText text="Accessible" />);
      expect(screen.getByLabelText("Accessible")).toBeInTheDocument();
      expect(screen.getByText("A")).toBeInTheDocument();
      vi.restoreAllMocks();
    });
  });

  describe("KineticRotator", () => {
    it("renders initial active word from words array", () => {
      const words = ["REACT", "THREE.JS", "TYPESCRIPT"];
      render(<KineticRotator words={words} interval={2000} />);
      expect(screen.getByText("REACT")).toBeInTheDocument();
    });

    it("holds the phrase showing, without rotating, once reduced motion is asked for", () => {
      // Round 18 (D-MOTION-002): the role line went on sliding and blurring every 3s under reduced motion.
      vi.useFakeTimers();
      const media = liveMotionQuery(false);
      try {
        render(<KineticRotator words={["ONE", "TWO", "THREE"]} interval={1000} />);
        expect(vi.getTimerCount()).toBe(1);
        act(() => media.set(true));
        expect(vi.getTimerCount()).toBe(0);
        act(() => { vi.advanceTimersByTime(5000); });
        const phrase = screen.getByText("ONE");
        expect(phrase.style.transform).toBe("");
        expect(phrase.style.filter).toBe("");
      } finally {
        media.restore();
        vi.useRealTimers();
      }
    });
  });

  describe("KineticHeading under a live motion change", () => {
    it("settles its words visible when reduced motion is asked for after mount", async () => {
      // Round 18 (D-UI-010): the Projects heading kept its hidden words and stayed invisible.
      const media = liveMotionQuery(false);
      try {
        const { container } = render(<KineticHeading text="Selected Work" as="h2" />);
        const words = [...container.querySelectorAll<HTMLElement>("h2 > span > span")];
        expect(words).toHaveLength(2);
        expect(words[0].style.opacity).toBe("0");
        act(() => media.set(true));
        await waitFor(() => {
          for (const word of [container.querySelector<HTMLElement>("h2 > span")!, ...words]) {
            expect(word.style.opacity).toBe("1");
          }
        });
      } finally { media.restore(); }
    });
  });
});

/** A reduced-motion query whose answer and change events the test controls. */
function liveMotionQuery(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() { return query === "(prefers-reduced-motion: reduce)" && matches; },
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
  return {
    set(value: boolean) {
      matches = value;
      listeners.forEach(listener => listener({ matches: value }));
    },
    restore() { window.matchMedia = original; },
  };
}
