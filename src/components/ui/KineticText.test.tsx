import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  KineticHeading,
  DancingCharText,
  KineticRotator,
  TelemetryBadge,
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
  });

  describe("TelemetryBadge", () => {
    it("renders technical coordinate telemetry with label and value", () => {
      render(<TelemetryBadge label="STATUS" value="ONLINE" />);
      expect(screen.getByText("STATUS")).toBeInTheDocument();
      expect(screen.getByText("ONLINE")).toBeInTheDocument();
    });

    it("renders with only label when value is omitted", () => {
      render(<TelemetryBadge label="ACTIVE" />);
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });

    it("adapts styles for light theme", () => {
      const { container } = render(<TelemetryBadge label="LOC" value="38.74, 9.01" theme="light" />);
      expect(container.firstChild).toHaveClass("bg-black/5");
    });
  });
});
