
import * as React from "react";
import { motion, AnimatePresence, PanInfo, LayoutGroup } from "framer-motion";
import { ChevronLeft, ChevronRight, Github, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { MagneticButton } from "./MagneticButton";
import { IndexPicker } from "./IndexPicker";
import styles from "./FocusRail.module.css";

export type FocusRailItem = {
  id: string | number;
  title: string;
  description?: React.ReactNode | string;
  imageSrc: string;
  imageAlt?: string;
  demoUrl?: string;
  repoUrl?: string;
  meta?: string;
  /** Consecutive items with the same group are listed under it in the picker. */
  group?: string;
};

interface FocusRailProps {
  items: FocusRailItem[];
  initialIndex?: number;
  loop?: boolean;
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  isFocused?: boolean;
  theme?: string;
  itemPickerLabel?: string;
}

/**
 * Shown when a project's image is missing.
 *
 * Inline, so a missing file costs nothing. The previous fallback pointed at
 * images.unsplash.com, which turned every 404 into a request to a third party
 * -- a stranger's photograph standing in for the reader's own work, fetched
 * across the network, on a page that otherwise loads entirely from its own
 * origin.
 */
const MISSING_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E" +
  "%3Crect width='16' height='9' fill='%230a0f0d'/%3E" +
  "%3Cpath d='M0 9L16 0' stroke='%2300ff9d' stroke-opacity='.12' stroke-width='.08'/%3E" +
  "%3Cpath d='M0 0L16 9' stroke='%2300ff9d' stroke-opacity='.12' stroke-width='.08'/%3E" +
  "%3C/svg%3E";

/** Swaps in the placeholder once, without looping if it too fails. */
function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.src === MISSING_IMAGE) return;
  image.src = MISSING_IMAGE;
}

/**
 * Helper to wrap indices (e.g., -1 becomes length-1)
 */
function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
  if (rangeSize <= 0) return min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
}

/**
 * Physics Configuration
 * Base spring for spatial movement (x/z)
 */
const BASE_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1,
};

/**
 * Scale Spring
 * Bouncier spring specifically for the visual "Click/Tap" feedback on the center card
 */
const TAP_SPRING = {
  type: "spring",
  stiffness: 450,
  damping: 18, // Lower damping = subtle overshoot/wobble "tap"
  mass: 1,
};

export function FocusRail({
  items,
  initialIndex = 0,
  loop = true,
  autoPlay = false,
  interval = 4000,
  className,
  isFocused = true,
  theme,
  itemPickerLabel,
}: FocusRailProps) {
  const [active, setActive] = React.useState(initialIndex);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const lastWheelTime = React.useRef<number>(0);

  const count = items.length;
  const activeIndex = wrap(0, count, active);
  const activeItem = items[activeIndex];
  const isLight = theme === "light";

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // --- NAVIGATION HANDLERS ---
  const handlePrev = React.useCallback(() => {
    if (!loop && active === 0) return;
    setActive((p) => p - 1);
  }, [loop, active]);

  const handleNext = React.useCallback(() => {
    if (!loop && active === count - 1) return;
    setActive((p) => p + 1);
  }, [loop, active, count]);

  // --- MOUSE WHEEL / TRACKPAD LOGIC ---
  // Lateral input browses; a plain vertical wheel stays the page's. Paging on
  // it as well turned one ordinary scroll past the rail into two actions: the
  // page moved and the project being read changed underneath it.
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const focused = e.currentTarget.ownerDocument.activeElement;
      if (e.target instanceof HTMLSelectElement ||
          (focused instanceof HTMLSelectElement && e.currentTarget.contains(focused))) return;
      const now = Date.now();
      // Debounce: prevent rapid firing from inertia scrolling (400ms lockout)
      if (now - lastWheelTime.current < 400) return;

      // Shift makes a vertical wheel lateral where the browser has not already.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;

      // Threshold to avoid accidental micro-scrolls
      if (Math.abs(delta) > 20) {
        if (delta > 0) {
          handleNext();
        } else {
          handlePrev();
        }
        lastWheelTime.current = now;
      }
    },
    [handleNext, handlePrev]
  );

  // Autoplay logic
  React.useEffect(() => {
    if (!autoPlay || isHovering) return;
    const timer = setInterval(() => handleNext(), interval);
    return () => clearInterval(timer);
  }, [autoPlay, isHovering, handleNext, interval]);

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
  };

  // --- SWIPE / DRAG LOGIC ---
  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
    const swipe = swipePower(offset.x, velocity.x);

    if (swipe < -swipeConfidenceThreshold) {
      handleNext();
    } else if (swipe > swipeConfidenceThreshold) {
      handlePrev();
    }
  };

  const visibleIndices = isMobile ? [-1, 0, 1] : [-2, -1, 0, 1, 2];
  const cardSpacing = isMobile ? 320 : 600;

  if (count === 0) return null;

  return (
    <motion.div
      layout
      transition={{ 
        layout: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
      }}
      className={cn(
        "group relative flex h-auto min-h-[500px] w-full flex-col outline-none select-none overflow-hidden",
        styles.rail,
        isLight ? styles.light : "bg-neutral-950",
        className
      )}
      data-testid="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Project carousel"
      aria-keyshortcuts="ArrowLeft ArrowRight"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`bg-${activeItem.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full"
          >
            <img
              src={activeItem.imageSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              className="h-full w-full object-cover blur-3xl saturate-200"
            />
            <div className={cn("absolute inset-0 bg-gradient-to-t",
              isLight ? "from-white via-white/85 to-white/60" : "from-neutral-950 via-neutral-950/50 to-transparent")} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main Stage (Fixed Height) */}
      <div className={cn("relative z-10 flex h-[420px] flex-col justify-center px-4 md:px-8 mt-4 shrink-0 overflow-visible", styles.stage)}>
        <motion.div
          className={cn("relative mx-auto flex h-[400px] w-full max-w-7xl items-center justify-center perspective-[1200px] cursor-grab active:cursor-grabbing", styles.track)}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={onDragEnd}
        >
          {visibleIndices.map((offset) => {
            const absIndex = active + offset;
            const index = wrap(0, count, absIndex);
            const item = items[index];

            if (!loop && (absIndex < 0 || absIndex >= count)) return null;

            const isCenter = offset === 0;
            const dist = Math.abs(offset);

            const xOffset = offset * cardSpacing;
            const zOffset = -dist * (isMobile ? 120 : 200);
            const scale = isCenter ? 1 : 0.85;
            const rotateY = offset * -25;

            const opacity = isCenter ? 1 : Math.max(0.1, 1 - dist * 0.5);
            const blur = isCenter ? 0 : dist * 6;
            const brightness = isCenter ? 1 : 0.4;

            return (
              <motion.div
                key={absIndex}
                className={cn(
                  "absolute aspect-video w-[300px] md:w-[580px] border border-white/20 bg-neutral-900 shadow-2xl transition-shadow duration-300 overflow-hidden", styles.card,
                  isCenter ? "z-20 border-emerald-400/50 shadow-[0_0_35px_rgba(0,255,157,0.25)]" : "z-10"
                )}
                initial={false}
                animate={{
                  x: xOffset,
                  z: zOffset,
                  scale: scale,
                  rotateY: rotateY,
                  opacity: opacity,
                  filter: `blur(${blur}px) brightness(${brightness})`,
                }}
                transition={(val: string) => {
                  if (val === "scale") return TAP_SPRING;
                  if (val === "filter") return { duration: 0.35, ease: "easeOut" };
                  return BASE_SPRING;
                }}
                style={{
                  transformStyle: "preserve-3d",
                  clipPath: "polygon(16px 0%, 100% 0%, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0% 100%, 0% 16px)",
                }}
                onClick={() => { if (offset !== 0) setActive((p) => p + offset); }}
              >
                <img
                  src={item.imageSrc}
                  alt={item.imageAlt ?? item.title}
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                  className="h-full w-full object-cover pointer-events-none"
                />
                <span className="sr-only">{item.title}</span>
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-black/20 pointer-events-none mix-blend-multiply" />

                {/* Laser Corner Accents */}
                {isCenter && (
                  <>
                    <span className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                    <span className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />
                  </>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Info & Controls (Dynamic Height) */}
      <div className={cn("relative z-10 w-full px-4 md:px-12 flex flex-col items-center justify-start pb-12", styles.reading)}
        data-focus-rail-reading="">
        <motion.div 
          layout
          className="w-full max-w-7xl flex flex-col md:flex-row items-start justify-between gap-12"
        >
          {/* Animated Info Section */}
          <div className="flex-1 w-full relative">
            <LayoutGroup id="project-info">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ 
                    duration: 0.4,
                    ease: "easeOut"
                  }}
                  className="space-y-6 w-full"
                >
                  <div className="space-y-4">
                    {activeItem.meta && (
                      <span className={cn("text-xs font-bold uppercase tracking-wider block", styles.category)}>
                        {activeItem.meta}
                      </span>
                    )}
                    <h2 className={cn("text-3xl font-bold tracking-tight md:text-5xl", styles.title)}>
                      {activeItem.title}
                    </h2>
                    
                    {/* Collapse the paint, not the normal-flow space (§7).
                        Contact's intersection controls this exit. Animating
                        height/margin changes Contact's position and rebuilds
                        ScrollControls, feeding the observer back into itself. */}
                    <motion.div
                      animate={{ 
                        clipPath: isFocused ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
                        opacity: isFocused ? 1 : 0,
                      }}
                      style={{ marginTop: 16 }}
                      initial={false}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 30,
                        opacity: { duration: 0.2 }
                      }}
                      className="overflow-hidden space-y-6 px-6 pb-6 -mx-6 -mb-6"
                    >
                      {/* The project's own actions, beside its name rather than after its whole description (round 11, D-UI-003). */}
                      <div className="flex flex-wrap items-center gap-4">
                        {activeItem.demoUrl && (
                          <MagneticButton
                            href={activeItem.demoUrl}
                            target="_blank"
                            variant="primary"
                            theme={theme}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-4 w-4" />
                            Visit Site
                          </MagneticButton>
                        )}
                        {activeItem.repoUrl && (
                          <MagneticButton
                            href={activeItem.repoUrl}
                            target="_blank"
                            variant="secondary"
                            icon={false}
                            theme={theme}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Github className="h-4 w-4" />
                            GitHub
                          </MagneticButton>
                        )}
                      </div>

                      {activeItem.description && (
                        <div className={cn("text-sm md:text-base leading-relaxed max-w-4xl", styles.description)}>
                          {activeItem.description}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </LayoutGroup>
          </div>

          {/* Nav Controls */}
          <div className="flex-shrink-0 flex items-center gap-4 pt-2 self-start sticky top-0">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full p-2 backdrop-blur-md",
                isLight ? "bg-white/75 ring-1 ring-black/15" : "bg-neutral-950/50 ring-1 ring-white/10"
              )}
            >
              <button
                onClick={handlePrev}
                aria-label="Previous project"
                className={cn("rounded-full p-3 transition hover:bg-white/10 active:scale-95", styles.navigationButton)}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {itemPickerLabel ? <IndexPicker items={items} index={activeIndex}
                label={itemPickerLabel} onSelect={setActive} /> : <div className="min-w-[70px] flex flex-col items-center justify-center leading-none">
                <span className={cn("text-xl font-bold font-mono", styles.current)}>
                  {String(activeIndex + 1).padStart(2, '0')}
                </span>
                <span className={cn("text-[11px] font-medium", styles.description)}>
                  /{String(count).padStart(2, '0')}
                </span>
              </div>}
              <button
                onClick={handleNext}
                aria-label="Next project"
                className={cn("rounded-full p-3 transition hover:bg-white/10 active:scale-95", styles.navigationButton)}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
