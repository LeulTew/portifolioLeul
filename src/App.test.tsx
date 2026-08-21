/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import { ThemeProvider } from "./components/sections/theme/ThemeProvider";

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

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
  root = null;
  rootMargin = "";
  thresholds = [];
}
window.IntersectionObserver = MockIntersectionObserver as any;

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = MockResizeObserver as any;

vi.mock("./lib/gateways/gpuTier", () => ({
  useGpuTier: () => ({ tier: "high", particleCount: 2000, dpr: 1.5 }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy({}, {
    get: (_target, prop: string) => {
      return ({ children, className, ...props }: any) => {
        const Tag = prop as any;
        const rest = { ...props };
        delete rest.layoutId;
        delete rest.initial;
        delete rest.animate;
        delete rest.exit;
        delete rest.transition;
        delete rest.whileHover;
        delete rest.whileTap;
        delete rest.whileInView;
        delete rest.viewport;
        return (
          <Tag className={className} {...rest}>
            {children}
          </Tag>
        );
      };
    },
  }),
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: vi.fn(),
  useThree: () => ({
    camera: { fov: 50, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() },
    size: { width: 1920, height: 1080 },
  }),
}));

const mockScroll = { el: document.createElement("div"), offset: 0 };

vi.mock("@react-three/drei", () => ({
  ScrollControls: ({ children }: any) => <div>{children}</div>,
  Scroll: ({ children }: any) => <div>{children}</div>,
  useScroll: () => mockScroll,
  Preload: () => null,
  useProgress: () => ({ active: false, progress: 100, loaded: 4, total: 4, errors: [] }),
  useGLTF: Object.assign(vi.fn(() => ({ scene: { clone: () => ({ traverse: vi.fn() }) } })), { preload: vi.fn() }),
  useVideoTexture: vi.fn(() => ({ flipY: false })),
  Environment: () => null,
  PerspectiveCamera: () => null,
  Points: ({ children }: any) => <>{children}</>,
  PointMaterial: () => null,
}));

vi.mock("./components/Loader", () => ({
  Loader: ({ onLoaded }: any) => {
    onLoaded?.();
    return <div data-testid="loader" role="progressbar" />;
  },
}));

vi.mock("./components/BackgroundScene", () => ({
  BackgroundScene: () => <div data-testid="background-scene" />,
}));

vi.mock("./components/ParticleBackground", () => ({
  default: () => <div data-testid="particle-background" />,
}));

vi.mock("./components/sections/Home/Home", () => ({
  Home: () => <div data-testid="home-section">Home Section</div>,
}));

vi.mock("./components/sections/About/About", () => ({
  About: () => <div data-testid="about-section">About Section</div>,
}));

vi.mock("./components/sections/Skills/Skills", () => ({
  Skills: () => <div data-testid="skills-section">Skills Section</div>,
}));

vi.mock("./components/sections/Projects/Projects", () => ({
  Projects: () => <div data-testid="projects-section">Projects Section</div>,
}));

vi.mock("./components/sections/Contact/Contact", () => ({
  Contact: () => <div data-testid="contact-section">Contact Section</div>,
}));

describe("App Component", () => {
  it("renders navigation and 3D canvas on initial mount", () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByTestId("r3f-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("background-scene")).toBeInTheDocument();
  });
});
