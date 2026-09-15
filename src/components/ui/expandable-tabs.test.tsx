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
});
