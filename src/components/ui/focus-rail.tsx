
import * as React from "react";
import { motion, AnimatePresence, PanInfo, LayoutGroup } from "framer-motion";
import { ChevronLeft, ChevronRight, Github, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { MagneticButton } from "./MagneticButton";

export type FocusRailItem = {
  id: string | number;
  title: string;
  description?: React.ReactNode | string;
  imageSrc: string;
  demoUrl?: string;
  repoUrl?: string;
  meta?: string;
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
}

/**
 * Helper to wrap indices (e.g., -1 becomes length-1)
 */
function wrap(min: number, max: number, v: number) {
  const rangeSize = max - min;
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
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      // Debounce: prevent rapid firing from inertia scrolling (400ms lockout)
      if (now - lastWheelTime.current < 400) return;

      // Detect horizontal scroll primarily, but also fallback to vertical if shift is held
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontal ? e.deltaX : e.deltaY;

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
        isLight ? "bg-white/65 text-neutral-900" : "bg-neutral-950 text-white",
        className
      )}
      data-testid="carousel"
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
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80';
              }}
              className="h-full w-full object-cover blur-3xl saturate-200"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Main Stage (Fixed Height) */}
      <div className="relative z-10 flex h-[420px] flex-col justify-center px-4 md:px-8 mt-4 shrink-0 overflow-visible">
        <motion.div
          className="relative mx-auto flex h-[400px] w-full max-w-7xl items-center justify-center perspective-[1200px] cursor-grab active:cursor-grabbing"
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
                  "absolute aspect-video w-[300px] md:w-[580px] rounded-2xl border-t border-white/20 bg-neutral-900 shadow-2xl transition-shadow duration-300",
                  isCenter ? "z-20 shadow-white/10" : "z-10"
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
                    return BASE_SPRING;
                }}
                style={{ transformStyle: "preserve-3d" }}
                onClick={() => { if (offset !== 0) setActive((p) => p + offset); }}
              >
                <img
                  src={item.imageSrc}
                  alt={item.title}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80';
                  }}
                  className="h-full w-full rounded-2xl object-cover pointer-events-none"
                />
                <span className="sr-only">{item.title}</span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                <div className="absolute inset-0 rounded-2xl bg-black/10 pointer-events-none mix-blend-multiply" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Info & Controls (Dynamic Height) */}
      <div className="relative z-10 w-full px-4 md:px-12 flex flex-col items-center justify-start pb-12">
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
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                        {activeItem.meta}
                      </span>
                    )}
                    <h2 className="text-3xl font-bold tracking-tight md:text-5xl text-white">
                      {activeItem.title}
                    </h2>
                    
                    {/* Collapsible Content Area */}
                    <motion.div
                      animate={{ 
                        height: isFocused ? "auto" : 0,
                        opacity: isFocused ? 1 : 0,
                        marginTop: isFocused ? 16 : 0
                      }}
                      initial={false}
                      transition={{ 
                        type: "spring", 
                        stiffness: 300, 
                        damping: 30,
                        opacity: { duration: 0.2 }
                      }}
                      className="overflow-hidden space-y-6 px-6 pb-6 -mx-6 -mb-6"
                    >
                      {activeItem.description && (
                        <div className="text-neutral-300 text-sm md:text-base leading-relaxed max-w-4xl">
                          {activeItem.description}
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="flex flex-wrap items-center gap-4 pt-2">
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
                className="rounded-full p-3 text-neutral-400 transition hover:bg-white/10 hover:text-white active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-[70px] flex flex-col items-center justify-center leading-none">
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  {String(activeIndex + 1).padStart(2, '0')}
                </span>
                <span className={cn("text-[11px] font-medium", isLight ? "text-neutral-800" : "text-neutral-600")}>
                  /{String(count).padStart(2, '0')}
                </span>
              </div>
              <button
                onClick={handleNext}
                className="rounded-full p-3 text-neutral-400 transition hover:bg-white/10 hover:text-white active:scale-95"
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
