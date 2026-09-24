import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FocusRail, type FocusRailItem } from "./focus-rail";

const mockItems: FocusRailItem[] = [
  {
    id: "1",
    title: "Project Alpha",
    description: "Alpha description text",
    imageSrc: "/images/projects/alpha.webp",
    demoUrl: "https://alpha.example.com",
    repoUrl: "https://github.com/example/alpha",
    meta: "Web Development",
  },
  {
    id: "2",
    title: "Project Beta",
    description: "Beta description text",
    imageSrc: "/images/projects/beta.webp",
    demoUrl: "https://beta.example.com",
    meta: "AI/DataScience",
  },
];

describe("FocusRail Component", () => {
  it("uses the same opaque, theme-aware reading surface without changing content or controls", () => {
    const { container, rerender } = render(<FocusRail items={mockItems} theme="light" />);
    const reader = container.querySelector('[data-focus-rail-reading]');
    expect(reader).toContainElement(screen.getByRole("heading", { name: "Project Alpha" }));
    expect(reader).toContainElement(screen.getByText("Alpha description text"));
    expect(screen.getByTestId("carousel").className).toContain("light");
    expect(screen.getByRole("heading", { name: "Project Alpha" })).not.toHaveClass("text-white");
    rerender(<FocusRail items={mockItems} theme="dark" />);
    expect(container.querySelector('[data-focus-rail-reading]')).toBe(reader);
    expect(reader).toContainElement(screen.getByRole("button", { name: "Next project" }));
    expect(screen.getByTestId("carousel").className).not.toContain("light");
  });

  it("renders active project title, meta, and navigation buttons", () => {
    render(<FocusRail items={mockItems} />);

    expect(screen.getByRole("heading", { level: 2, name: "Project Alpha" })).toBeInTheDocument();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next project/i })).toBeInTheDocument();
  });

  it("navigates to next project on next button click", () => {
    render(<FocusRail items={mockItems} />);

    const nextBtn = screen.getByRole("button", { name: /next project/i });
    fireEvent.click(nextBtn);

    expect(screen.getByRole("heading", { level: 2, name: "Project Beta" })).toBeInTheDocument();
  });

  it("navigates on keyboard ArrowLeft and ArrowRight", () => {
    render(<FocusRail items={mockItems} />);

    const carousel = screen.getByTestId("carousel");
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { level: 2, name: "Project Beta" })).toBeInTheDocument();

    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { level: 2, name: "Project Alpha" })).toBeInTheDocument();
  });

  it("leaves a vertical wheel to the page and browses only on lateral input", () => {
    // Regression: one ordinary scroll past the flat rail moved the page and
    // changed the project being read at the same time.
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    render(<FocusRail items={mockItems} />);
    const carousel = screen.getByTestId("carousel");
    // The counter is not animated, unlike the exiting heading kept for its exit.
    const position = () => screen.getByText(/^0\d$/).textContent;
    const vertical = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    fireEvent(carousel, vertical);
    expect(vertical.defaultPrevented).toBe(false);
    expect(position()).toBe("01");

    fireEvent.wheel(carousel, { deltaX: 120, deltaY: 8 });
    expect(position()).toBe("02");

    now.mockReturnValue(10_500);
    fireEvent.wheel(carousel, { deltaY: -120, shiftKey: true });
    expect(position()).toBe("01");
    now.mockRestore();
  });

  it("offers the same direct native selection in the flat reader without duplicate arrow or wheel paging", () => {
    render(<FocusRail items={mockItems} itemPickerLabel="Choose a project" />);
    const picker = screen.getByRole("combobox", { name: "Choose a project" });
    picker.focus();
    fireEvent.change(picker, { target: { value: "2" } });
    expect(screen.getByRole("heading", { name: "Project Beta" })).toBeInTheDocument();
    expect(picker).toHaveFocus();
    fireEvent.keyDown(picker, { key: "ArrowLeft" });
    fireEvent.wheel(picker, { deltaY: -400 });
    const retargeted = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    fireEvent(screen.getByTestId("carousel"), retargeted);
    expect(retargeted.defaultPrevented).toBe(false);
    expect(screen.getByRole("heading", { name: "Project Beta" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next project/i }));
    expect(screen.getByRole("heading", { name: "Project Alpha" })).toBeInTheDocument();
    expect(picker).toHaveValue("1");
  });

  it("keeps the description's normal-flow space throughout contact exit and reverse", async () => {
    const { rerender } = render(<FocusRail items={mockItems} isFocused />);
    const description = screen.getByText("Alpha description text");
    const details = description.parentElement!;
    const flowStyles = () => ({
      height: details.style.height,
      marginTop: details.style.marginTop,
      marginBottom: details.style.marginBottom,
      position: details.style.position,
      display: details.style.display,
    });
    const expandedFlow = flowStyles();
    const samples = [expandedFlow];
    // jsdom has no layout engine. Observe the actual Motion-written CSS instead
    // of inventing offsetHeights; browser sampling verifies the resulting track.
    const observer = new MutationObserver(() => samples.push(flowStyles()));
    observer.observe(details, { attributes: true, attributeFilter: ["style"] });

    try {
      rerender(<FocusRail items={mockItems} isFocused={false} />);
      await waitFor(() => expect(details).toHaveStyle({ opacity: "0" }));
      expect(flowStyles()).toEqual(expandedFlow);
      expect(details).toContainElement(description);
      await waitFor(() =>
        expect(details).toHaveStyle({ clipPath: "inset(0% 0% 100% 0%)" })
      );

      rerender(<FocusRail items={mockItems} isFocused />);
      await waitFor(() => expect(details).toHaveStyle({ opacity: "1" }));
      await waitFor(() =>
        expect(details).toHaveStyle({ clipPath: "inset(0% 0% 0% 0%)" })
      );
      expect(flowStyles()).toEqual(expandedFlow);
      expect(samples.every((sample) => JSON.stringify(sample) === JSON.stringify(expandedFlow))).toBe(true);
    } finally {
      observer.disconnect();
    }
  });
});
