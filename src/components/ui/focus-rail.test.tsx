import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
});
