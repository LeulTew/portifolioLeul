/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as ReactModule from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "./App";
import { ThemeProvider } from "./components/sections/theme/ThemeProvider";
import { setScrollProgress, subscribeScrollProgress } from "./lib/scroll/scrollProgress";
import { subscribeSectionNavigation } from "./lib/scroll/sectionNavigation";
import * as sectionTracking from "./lib/scroll/useActiveSection";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { ABOUT_SCREENS } from "./components/sections/About/statementLayers";
import { STATEMENT_ARRIVE, STATEMENT_CLEAR_SPAN, STATEMENT_SWAP } from "./components/sections/About/aboutBeats";

/*
 * These exercise the 3D path, so they say so.
 *
 * jsdom hands back no WebGL context, and App now asks before mounting a
 * Canvas -- rightly, since every section lives inside it. Left unmocked every
 * test here would silently be testing the flat fallback instead of the thing
 * it names. The fallback has its own test at the bottom of the file.
 */
const webglAvailable = vi.fn(() => true);
vi.mock("./lib/render/webglSupport", () => ({
  isWebGLAvailable: () => webglAvailable(),
  resetWebGLSupport: () => {},
}));

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

vi.mock("./lib/gateways/gpuTier", () => {
  const config = { tier: "high", softwareRenderer: false, particleCount: 2000, dpr: 1.5 };
  return { useGpuTier: () => config, getGpuTier: () => config };
});

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
    const state = { ...threeState, size: { ...threeState.size, height: track.clientHeight }, clock: { elapsedTime: now } };
    frameCallbacks.forEach((cb) => cb(state, delta));
  }
};

/**
 * Stands in for the renderer the governor drives -- and, through its canvas
 * and context, for the one the context-loss guard listens to.
 */
const threeState = {
  camera: { fov: 50, position: { set: vi.fn() }, updateProjectionMatrix: vi.fn() },
  size: { width: 1920, height: 1080 },
  viewport: { dpr: 1 },
  gl: {
    render: vi.fn(),
    domElement: document.createElement("canvas"),
    getContext: () => ({ isContextLost: () => false }),
  },
  scene: {},
};

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children, onCreated, ...props }: any) => {
    ReactModule.useEffect(() => { onCreated?.(threeState); }, [onCreated]);
    return <div data-testid="r3f-canvas" aria-hidden={props["aria-hidden"]}>{children}</div>;
  },
  useFrame: (cb: (state: any, delta: number) => void) => {
    if (!frameCallbacks.includes(cb)) frameCallbacks.push(cb);
  },
  useThree: (selector?: (state: any) => unknown) =>
    selector ? selector(threeState) : threeState,
}));

const mockScroll = {
  el: document.createElement("div"), fixed: document.createElement("div"),
  offset: 0, delta: 0, eps: 0.00001, pages: 1,
};

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
      mockScroll.pages = pages;
      track.rebuilds += 1;
      mockScroll.el.scrollTop = 1;
    }, [pages]);
    return (
      <div data-testid="scroll-controls" data-pages={pages}>{children}</div>
    );
  },
  Scroll: ({ children }: { children: ReactModule.ReactNode }) => (
    <div ref={node => { if (node) mockScroll.fixed = node; }}>
      <div data-testid="scroll-html">{children}</div>
    </div>
  ),
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

/**
 * Whether the stubbed loader reports itself finished as it renders.
 *
 * Off for the coverage cases below, which are about what the page looks like
 * *underneath* a loader that is still up.
 */
let loaderCompletesImmediately = true;
let completeLoader: (() => void) | undefined;

vi.mock("./components/Loader", () => ({
  Loader: ({ onLoaded }: any) => {
    completeLoader = onLoaded;
    if (loaderCompletesImmediately) onLoaded?.();
    return <div data-testid="loader" role="progressbar" />;
  },
}));

vi.mock("./components/BackgroundScene", () => ({
  BackgroundScene: () => <div data-testid="background-scene" />,
}));

vi.mock("./components/ParticleBackground", () => ({
  default: () => <div data-testid="particle-background" />,
}));

// The spatial stage is a lazy module in the page. Here it is handed over already
// resolved, through a thenable React.lazy reads at once, so each render is synchronous.
vi.mock("./components/3d/spatialStageModule", async () => {
  const stage = await vi.importActual<typeof import("./components/3d/SpatialStage")>("./components/3d/SpatialStage");
  const resolved = { then: (onFulfilled: (module: typeof stage) => unknown) => onFulfilled(stage) };
  return { loadSpatialStage: () => resolved };
});

vi.mock("./components/sections/Home/Home", () => ({
  Home: ({ introReady }: { introReady?: boolean }) =>
    <div data-testid="home-section" data-intro-ready={introReady}>Home Section</div>,
}));

vi.mock("./components/sections/About/About", () => ({
  About: () => <div data-testid="about-section">About Section</div>,
}));

vi.mock("./components/sections/Skills/Skills", () => ({
  Skills: ({ onNavigate }: { onNavigate?: import('./lib/scroll/sectionNavigation').SectionNavigate }) =>
    <div data-testid="skills-section">Skills Section
      <article data-testid="skills-chapter" id="skills-chapter" />
      <button onClick={() => onNavigate?.('skills', { source: 'navbar', anchor: 'skills-chapter' })}>
        Resume a Skills chapter
      </button>
    </div>,
}));

vi.mock("./components/sections/Projects/Projects", () => ({
  Projects: ({ onNavigate }: { onNavigate?: import('./lib/scroll/sectionNavigation').SectionNavigate }) =>
    <div data-testid="projects-section">Projects Section
      <button onClick={() => onNavigate?.('skills', { immediate: true, edge: 'end' })}>
        Return through Skills
      </button>
    </div>,
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

  it("hides only decorative canvas pixels from assistive technology, never the HTML render host", () => {
    threeState.gl.domElement.removeAttribute("aria-hidden");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(threeState.gl.domElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("r3f-canvas")).not.toHaveAttribute("aria-hidden");
    expect(screen.getByTestId("home-section").closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
  });

  describe("footer presentation", () => {
    afterEach(() => vi.restoreAllMocks());

    it("uses a footer landmark while keeping its ink mirror non-semantic", () => {
      render(<ThemeProvider><App /></ThemeProvider>);
      expect(screen.getByTestId("page-footer")).toHaveRole("contentinfo");
      const mirror = document.querySelector('[data-chapter-ink-layer] [data-page-footer]');
      expect(mirror?.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it("retires both ending invitations together, keeps copyright, and restores the invitation on return", () => {
      const tracking = vi.spyOn(sectionTracking, "useActiveSection").mockReturnValue("home");
      const { rerender } = render(<ThemeProvider><App /></ThemeProvider>);
      const footer = () => screen.getByTestId("page-footer");
      expect(footer()).toHaveTextContent("Scroll to explore");
      tracking.mockReturnValue("contact");
      rerender(<ThemeProvider><App /></ThemeProvider>);
      expect(footer()).not.toHaveTextContent("Scroll to explore");
      expect(footer()).toHaveTextContent(`© ${new Date().getFullYear()}`);
      expect(document.querySelector('[data-ink-text="Scroll to explore"]')).toBeNull();
      for (const paint of document.querySelectorAll('[data-page-footer]')) {
        expect(paint).toHaveAttribute("data-footer-section", "contact");
      }
      tracking.mockReturnValue("home");
      rerender(<ThemeProvider><App /></ThemeProvider>);
      expect(footer()).toHaveTextContent("Scroll to explore");
      expect(document.querySelector('[data-chapter-ink-layer] [data-ink-text="Scroll to explore"]')).not.toBeNull();
    });

    it("provides an in-flow document-end copyright lane instead of a compact reading overlay", () => {
      render(<ThemeProvider><App /></ThemeProvider>);
      const footer = screen.getByTestId("compact-page-footer");
      expect(footer.parentElement?.tagName).toBe("MAIN");
      expect(footer.parentElement?.lastElementChild).toBe(footer);
      expect(footer).toHaveTextContent(`© ${new Date().getFullYear()}`);
      expect(footer).not.toHaveTextContent("Scroll to explore");
      const css = postcss.parse(readFileSync(join(__dirname, "App.module.css"), "utf8"));
      const compact = css.nodes.find(node => node.type === "atrule" &&
        node.name === "media" && node.params === "(max-width: 1100px), (max-height: 730px)");
      expect(compact?.type).toBe("atrule");
      if (compact?.type !== "atrule") throw new Error("Missing compact footer layout");
      const displays: Record<string, string> = {};
      compact.walkRules(rule => {
        rule.walkDecls("display", declaration => { displays[rule.selector] = declaration.value; });
      });
      expect(displays).toEqual({ ".footer": "none", ".main > .compactFooter": "flex" });
      css.walkRules(".main > .compactFooter", rule => {
        rule.walkDecls("position", declaration => expect(declaration.value).not.toBe("fixed"));
        rule.walkDecls("min-height", declaration => expect(declaration.value).toBe("0"));
      });
    });

    it("keeps both Skills footer paints clear of the 48px controls without removing copyright", () => {
      render(<ThemeProvider><App /></ThemeProvider>);
      for (const paint of document.querySelectorAll('[data-page-footer]')) {
        expect(paint.querySelector('[class*="year"]')).not.toBeNull();
      }
      const css = postcss.parse(readFileSync(join(__dirname, "App.module.css"), "utf8"));
      const declarations = (selector: string) => {
        const values: Record<string, string> = {};
        css.walkRules(rule => {
          if (!rule.selectors.includes(selector)) return;
          rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
        });
        return values;
      };
      const owner = ":global(body:has(#skills[data-skills-active='true']))";
      expect(declarations(`${owner} .footer .scroll`)).toEqual({ display: "none" });
      expect(declarations(`${owner} .footer`)).toEqual({
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      });
      expect(declarations(`${owner} .footer .year`).display).toBeUndefined();
    });
  });

  it("marks both footer paints for the same Projects-only visibility rule", () => {
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(document.querySelectorAll('[data-page-footer]')).toHaveLength(2);
    expect(document.querySelector('[data-chapter-ink-layer] [data-page-footer]')).not.toBeNull();
    expect(screen.getByTestId('page-footer')).toHaveAttribute('data-page-footer');
  });
});

describe("what the loader is covering", () => {
  beforeEach(() => {
    loaderCompletesImmediately = false;
  });

  afterEach(() => {
    loaderCompletesImmediately = true;
  });

  it("mounts every section underneath the loader, before it starts to lift", () => {
    /*
     * The reported bug: the page showed its background and finished settling
     * *after* the load screen had gone.
     *
     * The sections used to be withheld until the loader announced that its
     * exit had begun, so everything that happens when they appear -- images
     * decoding, the webfont swapping, `<main>` being measured, ScrollControls
     * rebuilding its track and resetting scrollTop -- happened during the
     * overlay's fade, in full view. Mounting them under an opaque loader is
     * what makes the page look settled at the moment it is uncovered.
     */
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    // Still up, and nothing has told it to go.
    expect(screen.getByTestId("loader")).toBeInTheDocument();

    for (const id of ["home", "about", "skills", "projects", "contact"]) {
      expect(screen.getByTestId(`${id}-section`)).toBeInTheDocument();
    }
  });

  it("keeps the navigation and footer hidden until the loader has gone", () => {
    // The chrome is the one thing that should arrive with the page rather than
    // underneath it: there is nothing about it that needs to settle.
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByTestId("page-footer")).toBeNull();
  });

  it("releases the mounted hero entrance only when the loader finishes its exit", () => {
    render(<ThemeProvider><App /></ThemeProvider>);
    const home = screen.getByTestId("home-section");
    expect(home).toHaveAttribute("data-intro-ready", "false");
    expect(screen.getByTestId("loader")).toBeInTheDocument();
    act(() => completeLoader?.());
    expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-section")).toBe(home);
    expect(home).toHaveAttribute("data-intro-ready", "true");
  });
});

describe("App without a WebGL context", () => {
  beforeEach(() => {
    webglAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    webglAvailable.mockReturnValue(true);
  });

  const renderSettled = async () => {
    // The Loader mock reports done during its own render, so the state change
    // that reveals the sections has to be flushed before anything is asserted.
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );
    await act(async () => {});
  };

  it("keeps the scroll cue to Home, where it cannot sit over reading text", async () => {
    // Round 13 (D-UI-005): on the flat page the fixed cue crossed the project reader's prose.
    const tracking = vi.spyOn(sectionTracking, "useActiveSection").mockReturnValue("home");
    const { rerender } = render(<ThemeProvider><App /></ThemeProvider>);
    await act(async () => {});
    const footer = () => screen.getByTestId("page-footer");
    expect(footer()).toHaveTextContent("Scroll to explore");
    tracking.mockReturnValue("projects");
    rerender(<ThemeProvider><App /></ThemeProvider>);
    expect(footer()).not.toHaveTextContent("Scroll to explore");
    expect(footer()).toHaveTextContent(`© ${new Date().getFullYear()}`);
  });
  it("still renders the whole site", async () => {
    /*
     * Reported from Firefox: "Error creating WebGL context. WebGL is currently
     * disabled." Every section is rendered inside drei's `Scroll html`, which
     * lives inside the Canvas -- so a refused context did not cost the island,
     * it cost the entire portfolio, and the reader got a blank page reading
     * "something went wrong".
     *
     * Acceleration off, `webgl.disabled` set, a hardened profile, a
     * blocklisted driver: none of those are faults to recover from. The page
     * asks first and renders without.
     */
    await renderSettled();

    expect(screen.queryByTestId("r3f-canvas")).toBeNull();

    // The site itself, all of it, in ordinary document flow.
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    // Every section, in ordinary document flow rather than inside a canvas.
    for (const id of ["home", "about", "skills", "projects", "contact"]) {
      expect(screen.getByTestId(`${id}-section`)).toBeInTheDocument();
    }
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("does not show the error screen", () => {
    // The old failure mode, and the whole reason for asking up front.
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    );

    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
  });

  it("lands native About navigation inside the readable first beat in the flat document", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const announcePosition = vi.fn();
    window.addEventListener("scroll", announcePosition);
    try {
      await renderSettled();
      const target = screen.getByTestId("about-section");
      target.id = "about";
      target.getBoundingClientRect = () => DOMRect.fromRect({ y: 1400, height: 6000 });
      await user.click(screen.getByRole("button", { name: "About" }));
      const options = scrollTo.mock.lastCall?.[0] as ScrollToOptions;
      const progress = ((options.top ?? 0) - 1400 - window.scrollY) /
        (window.innerHeight * (ABOUT_SCREENS - 1));
      expect(options.behavior).toBe("auto");
      expect(progress).toBeGreaterThan(STATEMENT_ARRIVE.enter + STATEMENT_CLEAR_SPAN);
      expect(progress).toBeLessThan(STATEMENT_SWAP.exit);
      await user.click(screen.getByRole("button", { name: "About" }));
      expect(announcePosition).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener("scroll", announcePosition);
      scrollTo.mockRestore();
    }
  });

  it("lands a navigation that names an element of its section on that element, in the flat document", async () => {
    // Round 14 (D-MOTION-001): Skills resumes the chapter being read after a change of layout.
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    try {
      await renderSettled();
      screen.getByTestId("skills-section").id = "skills";
      screen.getByTestId("skills-chapter").getBoundingClientRect = () => DOMRect.fromRect({ y: 1500, height: 700 });
      fireEvent.click(screen.getByRole("button", { name: "Resume a Skills chapter" }));
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1500 + window.scrollY - 80, behavior: "auto" });
    } finally {
      scrollTo.mockRestore();
    }
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

  describe("a navbar choice made while the track rebuilds", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    /** A settled page, then a resize whose rebuild is still to land. */
    const resizing = () => {
      renderApp();
      for (const [name, top] of [["skills", 4000], ["contact", 7000]] as const) {
        const element = screen.getByTestId(`${name}-section`);
        element.id = name;
        Object.defineProperty(element, "offsetTop", { configurable: true, value: top });
      }
      act(() => runFrames(4));
      act(() => {
        contentHeight = 11000;
        window.dispatchEvent(new Event("resize"));
      });
    };

    it("is taken again once the new geometry is in place", () => {
      // Round 10 (D-NAV-001): the pre-resize offset was restored over the choice.
      resizing();
      const calls: string[] = [];
      const stop = subscribeSectionNavigation(id => calls.push(id));
      try {
        fireEvent.click(screen.getByRole("button", { name: "Skills" }));
        act(() => runFrames(1));
        act(() => vi.advanceTimersByTime(1));
        expect(calls).toEqual(["skills", "skills"]);
        expect(mockScroll.offset).toBeCloseTo((4000 - 80) / 10000);
        // Round 16 (TECH-055): the rebuilt track ignores its first scroll, so the replay announces
        // its place again for two frames, or Drei damps back to the target from before the rebuild.
        const announced = vi.spyOn(mockScroll.el, "dispatchEvent");
        act(() => runFrames(3));
        expect(announced.mock.calls.filter(([event]) => event.type === "scroll")).toHaveLength(2);
        expect(mockScroll.offset).toBeCloseTo((4000 - 80) / 10000);
      } finally { stop(); }
    });

    it("is kept for the rebuild when the layout has changed but not yet been reported", () => {
      // Round 16 (TECH-055): Contact chosen in the frame after a motion change, before the content
      // observer ran, was placed on the half-built layout and never taken again.
      renderApp();
      for (const [name, top] of [["skills", 4000], ["contact", 7000]] as const) {
        const element = screen.getByTestId(`${name}-section`);
        element.id = name;
        Object.defineProperty(element, "offsetTop", { configurable: true, value: top });
      }
      act(() => runFrames(4));
      const calls: string[] = [];
      const stop = subscribeSectionNavigation(id => calls.push(id));
      try {
        contentHeight = 11000;
        fireEvent.click(screen.getByRole("button", { name: "Skills" }));
        // The observer reports the change only now, and the track rebuilds.
        act(() => { window.dispatchEvent(new Event("resize")); });
        act(() => runFrames(1));
        act(() => vi.advanceTimersByTime(1));
        expect(calls).toEqual(["skills", "skills"]);
        expect(mockScroll.offset).toBeCloseTo((4000 - 80) / 10000);
      } finally { stop(); }
    });

    it("never lands over a newer choice made before it replays", () => {
      // Round 11 (TECH-032): the queued replay of Skills ran after a later Contact click.
      resizing();
      const calls: string[] = [];
      const stop = subscribeSectionNavigation(id => calls.push(id));
      try {
        fireEvent.click(screen.getByRole("button", { name: "Skills" }));
        act(() => runFrames(1));
        fireEvent.click(screen.getByRole("button", { name: "Contact" }));
        act(() => vi.advanceTimersByTime(1));
        expect(calls.at(-1)).toBe("contact");
        expect(mockScroll.offset).toBeCloseTo((7000 - 80) / 10000);
      } finally { stop(); }
    });
  });

  it("settles navbar intent and physical/damped position together without traversing intermediate sections", () => {
    renderApp();
    const target = screen.getByTestId('contact-section');
    target.id = 'contact';
    Object.defineProperty(target, 'offsetTop', { configurable: true, value: 6000 });
    const listener = vi.fn();
    const unsubscribe = subscribeSectionNavigation(listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
      expect(listener).toHaveBeenCalledExactlyOnceWith('contact', { source: 'navbar' });
      const ratio = (6000 - 80) / (contentHeight - track.clientHeight);
      expect(mockScroll.offset).toBeCloseTo(ratio);
      expect(mockScroll.delta).toBe(0);
      expect(mockScroll.el.scrollTop).toBeCloseTo(ratio * (mockScroll.el.scrollHeight - track.clientHeight));
      act(() => runFrames(5));
      expect(mockScroll.offset).toBeCloseTo(ratio);
    } finally {
      unsubscribe();
    }
  });

  it("lands native About navigation inside the readable first beat on the scene scrollport", async () => {
    const user = userEvent.setup();
    renderApp();
    const target = screen.getByTestId("about-section");
    target.id = "about";
    Object.defineProperty(target, "offsetTop", { configurable: true, value: 1400 });
    const listener = vi.fn();
    const unsubscribe = subscribeSectionNavigation(listener);
    try {
      await user.click(screen.getByRole("button", { name: "About" }));
      const landing = mockScroll.offset * (contentHeight - track.clientHeight);
      const progress = (landing - 1400) / (track.clientHeight * (ABOUT_SCREENS - 1));
      expect(listener).toHaveBeenCalledExactlyOnceWith("about", { source: "navbar" });
      expect(progress).toBeGreaterThan(STATEMENT_ARRIVE.enter + STATEMENT_CLEAR_SPAN);
      expect(progress).toBeLessThan(STATEMENT_SWAP.exit);
      expect(mockScroll.delta).toBe(0);
      expect(mockScroll.el.scrollTop).toBeCloseTo(mockScroll.offset * (mockScroll.el.scrollHeight - track.clientHeight));
    } finally {
      unsubscribe();
    }
  });

  it("settles the Projects reverse landing at the trailing Skills edge without navbar bypass", () => {
    renderApp();
    const target = screen.getByTestId('skills-section');
    target.id = 'skills';
    Object.defineProperty(target, 'offsetTop', { configurable: true, value: 5000 });
    Object.defineProperty(target, 'offsetHeight', { configurable: true, value: 3000 });
    const listener = vi.fn();
    const unsubscribe = subscribeSectionNavigation(listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Return through Skills' }));
      expect(listener).toHaveBeenCalledExactlyOnceWith('skills', { immediate: true, edge: 'end' });
      const ratio = (5000 + 3000 - track.clientHeight + 80) / (contentHeight - track.clientHeight);
      expect(mockScroll.offset).toBeCloseTo(ratio);
      expect(mockScroll.delta).toBe(0);
      expect(mockScroll.el.scrollTop).toBeCloseTo(ratio * (mockScroll.el.scrollHeight - track.clientHeight));
      act(() => runFrames(5));
      expect(mockScroll.offset).toBeCloseTo(ratio);
    } finally {
      unsubscribe();
    }
  });

  it("maps navigation onto the range the layer is drawn across, not the content's newer height", () => {
    // Round 15 (TECH-049): growth inside the rebuild deadband left navbar Skills 25px short of its entry.
    renderApp();
    const target = screen.getByTestId('contact-section');
    target.id = 'contact';
    Object.defineProperty(target, 'offsetTop', { configurable: true, value: 6000 });
    const pages = track.pages;
    contentHeight += 100;
    fireEvent.click(screen.getByRole('button', { name: 'Contact' }));
    expect(track.pages).toBe(pages);
    // Where the layer draws the section: offset * (pages - 1) screens, 80px under the top.
    expect(mockScroll.offset * (track.pages - 1) * track.clientHeight).toBeCloseTo(6000 - 80);
  });

  it("lands a navigation that names an element of its section on that element, on the scene scrollport", () => {
    renderApp();
    const target = screen.getByTestId('skills-section');
    target.id = 'skills';
    Object.defineProperty(target, 'offsetTop', { configurable: true, value: 5000 });
    // Drawn through the layer's translation; only their difference is layout.
    target.getBoundingClientRect = () => DOMRect.fromRect({ y: -600, height: 3000 });
    screen.getByTestId('skills-chapter').getBoundingClientRect = () => DOMRect.fromRect({ y: 600, height: 700 });
    fireEvent.click(screen.getByRole('button', { name: 'Resume a Skills chapter' }));
    expect(mockScroll.offset).toBeCloseTo((5000 + 1200 - 80) / (contentHeight - track.clientHeight));
  });

  it("keeps a reader in their chapter when content above them grows", () => {
    // Round 17: re-staging Skills above a Contact reader kept the pixel offset and showed Projects.
    renderApp();
    act(() => runFrames(4));
    const contact = screen.getByTestId('contact-section');
    contact.id = 'contact';
    let contactTop = 7000;
    Object.defineProperty(contact, 'offsetTop', { configurable: true, get: () => contactTop });
    // The page measures its chapters with its layout (a same-size resize here).
    act(() => { window.dispatchEvent(new Event("resize")); });
    // Reading Contact, 100px into it: 7100 of the 8000 drawn pixels.
    const progress = 7100 / ((track.pages - 1) * track.clientHeight);
    act(() => {
      mockScroll.el.scrollTop = progress * (mockScroll.el.scrollHeight - track.clientHeight);
      mockScroll.offset = progress;
      setScrollProgress(progress);
    });
    // Skills re-staged above it: everything from Projects on moves 2000px down.
    contactTop = 9000;
    act(() => {
      contentHeight = 11000;
      window.dispatchEvent(new Event("resize"));
    });
    act(() => runFrames(3));
    expect(track.pages).toBeCloseTo(11, 5);
    expect(mockScroll.offset * (track.pages - 1) * track.clientHeight).toBeCloseTo(9100, 0);
  });

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

  it("restores native focus when a content resize detaches and reattaches the scroll track", () => {
    renderApp();
    const button = document.createElement("button");
    button.textContent = "Retained reader control";
    mockScroll.el.append(button);
    document.body.append(mockScroll.el);
    const rect = DOMRect.fromRect({ width: 48, height: 48 });
    vi.spyOn(button, "getClientRects")
      .mockReturnValue(Object.assign([rect], { item: (index: number) => index === 0 ? rect : null }));
    try {
      button.focus();
      act(() => {
        contentHeight = 11000;
        window.dispatchEvent(new Event("resize"));
      });
      mockScroll.el.remove();
      document.body.append(mockScroll.el);
      expect(document.activeElement).toBe(document.body);
      act(() => runFrames(3));
      expect(button).toHaveFocus();
    } finally {
      button.remove();
      mockScroll.el.remove();
    }
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

  it("restores Drei's rendered offset before publishing any chapter measurements", () => {
    renderApp();
    const html = screen.getByTestId("scroll-html");
    mockScroll.el.scrollTop = 4000;
    mockScroll.offset = 4000 / (mockScroll.el.scrollHeight - track.clientHeight);
    setScrollProgress(mockScroll.offset);
    const seen: Array<{ progress: number; transform: string }> = [];
    const unsubscribe = subscribeScrollProgress(progress => {
      seen.push({ progress, transform: html.style.transform });
    });

    act(() => {
      contentHeight = 11000;
      window.dispatchEvent(new Event("resize"));
    });
    // This is the new state object Drei creates when its pages change.
    mockScroll.offset = 0;
    mockScroll.delta = 0.1;
    act(() => runFrames(1));
    unsubscribe();

    const restored = mockScroll.el.scrollTop / (mockScroll.el.scrollHeight - track.clientHeight);
    expect(restored).toBeGreaterThan(0);
    expect(mockScroll.offset).toBeCloseTo(restored, 8);
    expect(mockScroll.delta).toBe(0);
    expect(seen).toEqual([{
      progress: restored,
      transform: `translate3d(0px, ${-1000 * (pagesOf() - 1) * restored}px, 0px)`,
    }]);
  });

  it("reconciles a stale HTML translation when Drei has settled at zero delta", () => {
    renderApp();
    const html = screen.getByTestId("scroll-html");
    html.style.transform = "translate3d(0px, -5585.37px, 0px)";
    mockScroll.offset = 0;
    mockScroll.delta = 0;
    mockScroll.el.scrollTop = 0;
    setScrollProgress(0);
    const republished = vi.fn();
    const unsubscribe = subscribeScrollProgress(republished);

    act(() => runFrames(3));
    unsubscribe();

    expect(html.style.transform).toBe("translate3d(0px, 0px, 0px)");
    expect(republished).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("leaves moving and not-yet-restored translations to Drei", () => {
    renderApp();
    const html = screen.getByTestId("scroll-html");
    const previous = "translate3d(0px, -1000px, 0px)";
    html.style.transform = previous;
    mockScroll.offset = 0;
    mockScroll.delta = 0.1;
    mockScroll.el.scrollTop = 0;
    act(() => runFrames());
    expect(html.style.transform).toBe(previous);

    mockScroll.delta = 0;
    mockScroll.el.scrollTop = 3000;
    act(() => runFrames());
    expect(html.style.transform).toBe(previous);
  });

  it("does not rewrite or measure an already reconciled idle HTML layer", async () => {
    renderApp();
    const html = screen.getByTestId("scroll-html");
    mockScroll.offset = 0;
    mockScroll.delta = 0;
    mockScroll.el.scrollTop = 0;
    act(() => runFrames(3));
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver(records => writes.push(...records));
    const heightReads = vi.spyOn(mockScroll.el, 'scrollHeight', 'get');
    const viewportReads = vi.spyOn(mockScroll.el, 'clientHeight', 'get');
    observer.observe(html, { attributes: true, attributeFilter: ["style"] });
    await act(async () => runFrames(30));
    observer.disconnect();
    expect(writes).toHaveLength(0);
    expect(heightReads).not.toHaveBeenCalled();
    expect(viewportReads).not.toHaveBeenCalled();
    heightReads.mockRestore();
    viewportReads.mockRestore();
  });
});

describe("App content settling", () => {
  const originalObserver = globalThis.ResizeObserver;
  const originalInnerHeight = window.innerHeight;
  let notify: (() => void) | null = null;
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null;
  let contentHeight = 9000;
  let observers: Array<() => void> = [];

  // Like the browser, a resize notifies every observer, not only the last one constructed.
  class BurstResizeObserver {
    constructor(callback: () => void) {
      observers.push(callback);
      notify = () => { for (const observer of observers) observer(); };
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  beforeEach(() => {
    vi.useFakeTimers();
    frameCallbacks.length = 0;
    notify = null;
    observers = [];
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
