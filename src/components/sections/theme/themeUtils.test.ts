import { describe, it, expect, vi, afterEach } from "vitest";
import { getInitialTheme } from "./themeUtils";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("themeUtils - getInitialTheme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorageMock.clear();
  });

  it("returns light when window is undefined (SSR fallback)", () => {
    vi.stubGlobal("window", undefined);
    expect(getInitialTheme()).toBe("light");
  });

  it("returns saved theme from localStorage when valid value exists", () => {
    localStorageMock.setItem("theme", "light");
    expect(getInitialTheme()).toBe("light");

    localStorageMock.setItem("theme", "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("defaults to light when localStorage contains no saved theme", () => {
    expect(getInitialTheme()).toBe("light");
  });
});
