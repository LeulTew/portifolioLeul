import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TelegramIcon } from "./TelegramIcon";

describe("TelegramIcon Component", () => {
  it("renders svg icon with custom size and class", () => {
    const { container } = render(<TelegramIcon size="24px" className="custom-telegram" />);
    const svg = container.querySelector("svg");

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "24px");
    expect(svg).toHaveAttribute("height", "24px");
    expect(svg).toHaveClass("custom-telegram");
  });
});
