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
  it("renders tablist and tab buttons with accessible roles", () => {
    render(<ExpandableTabs tabs={mockTabs} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("selects first tab by default and switches tab on click", () => {
    const onChange = vi.fn();
    render(<ExpandableTabs tabs={mockTabs} onChange={onChange} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(tabs[1]);
    expect(onChange).toHaveBeenCalledWith(1);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("renders separator cleanly", () => {
    const { container } = render(<ExpandableTabs tabs={mockTabs} />);
    const separator = container.querySelector("[aria-hidden=\"true\"]");
    expect(separator).toBeInTheDocument();
  });
});
