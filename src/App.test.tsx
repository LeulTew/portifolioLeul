/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act } from "@testing-library/react";
import * as ReactModule from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

/** Frame callbacks registered through useFrame, so tests can drive the loop. */
const frameCallbacks: Array<(state: any, delta: number) => void> = [];

/**
 * Elapsed time, monotonic across the file as a real clock is. The render gate
 * treats time running backwards as a restarted clock, so a per-call counter
 * would quietly exercise a different path than production.
 */
let clockTime = 0;

const runFrames = (count = 1, delta = 0.016) => {
  for (let i = 0; i < count; i += 1) {
    clockTime += delta;
    const now = clockTime;
    const state = { clock: { getElapsedTime: () => now } };
    frameCallbacks.forEach((cb) => cb(state, delta));
  }
};

/** Stands in for the renderer the governor drives. */
const threeState = {
  camera: { fov: 50, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() },
  size: { width: 1920, height: 1080 },
  gl: { render: vi.fn() },
  scene: {},
};

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: any) => <div data-testid="r3f-canvas">{children}</div>,
  useFrame: (cb: (state: any, delta: number) => void) => {
    if (!frameCallbacks.includes(cb)) frameCallbacks.push(cb);
  },
  useThree: (selector?: (state: any) => unknown) =>
    selector ? selector(threeState) : threeState,
}));

const mockScroll = { el: document.createElement("div"), offset: 0 };

/**
 * The track's geometry, modelled on ScrollControls: it stacks a sticky
 * full-height element plus a fill of `pages * 100%`, so scrollHeight works out
 * to (pages + 1) * clientHeight.
 */
const track = { clientHeight: 1000, pages: 1, rebuilds: 0 };

Object.defineProperty(mockScroll.el, "clientHeight", {
  configurable: true,
  get: () => track.clientHeight,
});
Object.defineProperty(mockScroll.el, "scrollHeight", {
  configurable: true,
  get: () => (track.pages + 1) * track.clientHeight,
});

vi.mock("@react-three/drei", () => ({
  ScrollControls: ({ children, pages }: any) => {
    // Mirrors drei: `pages` is in the deps of the effect that builds the track,
    // that effect resizes the fill, and it resets scrollTop to 1 on every run.
    ReactModule.useEffect(() => {
      track.pages = pages;
      track.rebuilds += 1;
      mockScroll.el.scrollTop = 1;
    }, [pages]);
    return (
      <div data-testid="scroll-controls" data-pages={pages}>{children}</div>
    );
  },
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

describe("App scroll track sizing", () => {
  const originalInnerHeight = window.innerHeight;
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null;

  const setViewportHeight = (height: number) => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: height,
    });
  };

  const stubContentHeight = (height: number) => {
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(height);
  };

  afterEach(() => {
    scrollHeightSpy?.mockRestore();
    scrollHeightSpy = null;
    setViewportHeight(originalInnerHeight);
  });

  const renderApp = () =>
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

  const pagesOf = () =>
    Number(screen.getByTestId("scroll-controls").getAttribute("data-pages"));

  it("maps content height onto the scroll track one-to-one", () => {
    setViewportHeight(1000);
    stubContentHeight(4200);

    renderApp();

    // pages === contentHeight / viewportHeight is exactly the ratio drei needs
    // to translate the html layer across its full height and stop there.
    expect(pagesOf()).toBeCloseTo(4.2, 5);
  });

  it("adds no dead scroll beyond the end of the content", () => {
    setViewportHeight(720);
    stubContentHeight(720 * 6);

    renderApp();

    expect(pagesOf()).toBeCloseTo(6, 5);
  });

  it("does not shrink the track below a single viewport", () => {
    setViewportHeight(1000);
    stubContentHeight(200);

    renderApp();

    expect(pagesOf()).toBe(1);
  });

  it("sizes the track from content height, not from viewport width", () => {
    // The previous implementation bolted on 16.5 extra pages at <=1366px wide,
    // which stranded the user in empty scroll after the last section.
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    setViewportHeight(1000);
    stubContentHeight(3000);

    renderApp();

    expect(pagesOf()).toBeCloseTo(3, 5);
  });
});

describe("App scroll position across a track resize", () => {
  const originalInnerHeight = window.innerHeight;
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null;
  let contentHeight = 9000;

  const setViewportHeight = (height: number) => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: height,
    });
  };

  beforeEach(() => {
    frameCallbacks.length = 0;
    contentHeight = 9000;
    track.clientHeight = 1000;
    setViewportHeight(1000);
    // The <main> element and the track both read scrollHeight; only <main>
    // drives the page count, so vary it through the shared spy.
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(() => contentHeight);
  });

  afterEach(() => {
    scrollHeightSpy?.mockRestore();
    scrollHeightSpy = null;
    setViewportHeight(originalInnerHeight);
  });

  const renderApp = () =>
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

  const pagesOf = () =>
    Number(screen.getByTestId("scroll-controls").getAttribute("data-pages"));

  it("does not throw the reader back to the top when content grows", () => {
    // Regression: ScrollControls resets scrollTop to 1 whenever `pages`
    // changes, so a lazily loaded image mid-scroll yanked the page to the top.
    renderApp();
    expect(pagesOf()).toBeCloseTo(9, 5);

    // Reader is halfway down a 9-page track.
    mockScroll.el.scrollTop = 4000;

    act(() => {
      contentHeight = 11000;
      window.dispatchEvent(new Event("resize"));
    });
    act(() => runFrames(3));

    expect(pagesOf()).toBeCloseTo(11, 5);
    expect(mockScroll.el.scrollTop).toBeGreaterThan(1);
  });

  it("keeps the same content under the reader across the resize", () => {
    renderApp();

    /**
     * How far the html layer is translated. ScrollControls derives its offset
     * from the track's own scrollable length -- pages * clientHeight -- and
     * then translates the content by offset * (pages - 1) * clientHeight.
     */
    const contentTranslation = (pages: number) => {
      const scrollable = (pages + 1) * track.clientHeight - track.clientHeight;
      const offset = mockScroll.el.scrollTop / scrollable;
      return offset * (pages - 1) * track.clientHeight;
    };

    mockScroll.el.scrollTop = 4000;
    const translationBefore = contentTranslation(9);

    act(() => {
      contentHeight = 11000;
      window.dispatchEvent(new Event("resize"));
    });
    act(() => runFrames(3));

    // Same pixel of content under the reader, on a track two pages longer.
    expect(contentTranslation(11)).toBeCloseTo(translationBefore, 4);
  });

  it("leaves a reader at the very top at the top", () => {
    renderApp();

    mockScroll.el.scrollTop = 0;

    act(() => {
      contentHeight = 11000;
      window.dispatchEvent(new Event("resize"));
    });
    act(() => runFrames(3));

    expect(mockScroll.el.scrollTop).toBe(0);
  });
});

describe("App content settling", () => {
  const originalObserver = globalThis.ResizeObserver;
  const originalInnerHeight = window.innerHeight;
  let notify: (() => void) | null = null;
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null;
  let contentHeight = 9000;

  class BurstResizeObserver {
    constructor(callback: () => void) {
      notify = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
    vi.useFakeTimers();
    frameCallbacks.length = 0;
    notify = null;
    contentHeight = 9000;
    track.clientHeight = 1000;
    track.rebuilds = 0;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 1000,
    });
    scrollHeightSpy = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockImplementation(() => contentHeight);
    (globalThis as any).ResizeObserver = BurstResizeObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    scrollHeightSpy?.mockRestore();
    (globalThis as any).ResizeObserver = originalObserver;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    });
  });

  it("collapses a burst of layout changes into a single track rebuild", () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    const rebuildsAfterMount = track.rebuilds;

    // Images and fonts landing one after another, as they do on first paint.
    act(() => {
      for (const height of [9500, 10000, 10500, 11000]) {
        contentHeight = height;
        notify?.();
      }
      vi.advanceTimersByTime(500);
    });

    expect(track.rebuilds).toBe(rebuildsAfterMount + 1);
    expect(
      Number(screen.getByTestId("scroll-controls").getAttribute("data-pages"))
    ).toBeCloseTo(11, 5);
  });

  it("ignores layout jitter too small to matter", () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    const rebuildsAfterMount = track.rebuilds;

    act(() => {
      contentHeight = 9050;
      notify?.();
      vi.advanceTimersByTime(500);
    });

    expect(track.rebuilds).toBe(rebuildsAfterMount);
  });
});
