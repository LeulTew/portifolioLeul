import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExpandableTabs } from "./expandable-tabs";
import { Globe, Brain, Smartphone } from "lucide-react";

const mockTabs = [
  { title: "Web", icon: Globe },
  { title: "AI", icon: Brain },
  { type: "separator" as const },
  { title: "Mobile", icon: Smartphone },
];

describe("ExpandableTabs Component", () => {
  it("renders filters as named toggle buttons rather than tabs without panels", () => {
    render(<ExpandableTabs tabs={mockTabs} />);

    expect(screen.getByRole("group", { name: "Filter categories" })).toBeInTheDocument();
    const tabs = screen.getAllByRole("button");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("type", "button");
      expect(tab.className).toContain("min-h-[50px]");
      expect(tab.className).toContain("min-w-[50px]");
      expect(tab.className).toContain("focus-visible:outline-2");
      expect(tab.className).toContain("focus-visible:[outline-style:solid]");
    }
  });

  it("selects first tab by default and switches tab on click", () => {
    const onChange = vi.fn();
    render(<ExpandableTabs tabs={mockTabs} onChange={onChange} />);

    const tabs = screen.getAllByRole("button");
    expect(tabs[0]).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(tabs[1]);
    expect(onChange).toHaveBeenCalledWith(1);
    expect(tabs[1]).toHaveAttribute("aria-pressed", "true");
    expect(tabs[0]).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(tabs[2]);
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(tabs[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("renders separator cleanly", () => {
    const { container } = render(<ExpandableTabs tabs={mockTabs} />);
    const separator = container.querySelector("div[aria-hidden=\"true\"]");
    expect(separator).toBeInTheDocument();
  });

  it("accepts a surface-specific accessible group name", () => {
    render(<ExpandableTabs tabs={mockTabs} ariaLabel="Filter projects" />);
    expect(screen.getByRole("group", { name: "Filter projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Web" })).toBeInTheDocument();
  });

  it("names an inactive category on hover and keyboard focus without moving the row", () => {
    // Round 9 (D-UX-001): inactive fallback categories showed only an icon, even on hover or focus.
    const { container } = render(<ExpandableTabs tabs={mockTabs} />);
    const hints = [...container.querySelectorAll<HTMLElement>("[data-tab-hint]")];
    expect(hints.map(hint => hint.textContent)).toEqual(["AI", "Mobile"]);
    for (const hint of hints) {
      expect(hint).toHaveAttribute("aria-hidden", "true");
      expect(hint.closest("button")!.className).toContain("group");
      expect(hint.className).toContain("absolute");
      expect(hint.className).toContain("opacity-0");
      expect(hint.className).toContain("[.group:hover_&]:opacity-100");
      expect(hint.className).toContain("[.group:focus-visible_&]:opacity-100");
    }
    expect(screen.getByRole("button", { name: "AI" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect([...container.querySelectorAll("[data-tab-hint]")].map(hint => hint.textContent)).toEqual(["Web", "Mobile"]);
  });
});
