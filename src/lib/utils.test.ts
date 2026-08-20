import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("merges class names correctly", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes and falsy values", () => {
    const isHidden = false;
    const isVisible = true;
    expect(cn("base-class", isHidden && "hidden", isVisible && "visible", null, undefined, "active")).toBe("base-class visible active");
  });

  it("resolves Tailwind class conflicts with tailwind-merge", () => {
    expect(cn("px-2 text-red-500", "px-4 text-blue-500")).toBe("px-4 text-blue-500");
  });
});
