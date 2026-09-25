"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { LucideIcon } from "lucide-react";
import { ThemeContext } from "../sections/theme/ThemeContext";

interface Tab {
  title: string;
  mobileTitle?: string;
  icon: LucideIcon;
  type?: never;
}

interface Separator {
  type: "separator";
  title?: never;
  mobileTitle?: never;
  icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
  tabs: TabItem[];
  ariaLabel?: string;
  className?: string;
  activeColor?: string;
  onChange?: (index: number | null) => void;
  theme?: string;
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (custom: { isSelected: boolean; is720p: boolean }) => ({
    gap: custom.isSelected ? (custom.is720p ? ".4rem" : ".5rem") : 0,
    paddingLeft: custom.isSelected ? (custom.is720p ? ".8rem" : "1rem") : (custom.is720p ? ".4rem" : ".5rem"),
    paddingRight: custom.isSelected ? (custom.is720p ? ".8rem" : "1rem") : (custom.is720p ? ".4rem" : ".5rem"),
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 };

export function ExpandableTabs({
  tabs,
  ariaLabel = "Filter categories",
  className,
  onChange,
  theme: propTheme,
}: ExpandableTabsProps) {
  const [selected, setSelected] = React.useState<number | null>(0);

  const [is720p, setIs720p] = React.useState(false);
  const context = React.useContext(ThemeContext);
  const theme = propTheme || context?.theme || 'dark';
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  React.useEffect(() => {
    // Force re-render when theme changes
    forceUpdate();
  }, [theme]);

  React.useEffect(() => {
    const checkResponsive = () => {
      const width = window.innerWidth;

      setIs720p(width >= 768 && width <= 1366);
    };
    checkResponsive();
    window.addEventListener('resize', checkResponsive);
    return () => window.removeEventListener('resize', checkResponsive);
  }, []);

  const handleSelect = (index: number) => {
    setSelected(index);
    onChange?.(index);
  };

  const Separator = () => (
    <div className="mx-1 h-[24px] w-[1.2px] bg-white/20" aria-hidden="true" />
  );

  const isLight = theme === 'light';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-full border border-[var(--pill-rail-border)] bg-[var(--pill-rail-bg)] p-2",
        className
      )}
    >
      {tabs.map((tab, index) => {
        if (tab.type === "separator") {
          return <Separator key={`separator-${index}`} />;
        }

        const Icon = tab.icon;
        const displayTitle = tab.title;
        const isSelected = selected === index;
        
        return (
          <motion.button
            key={tab.title}
            type="button"
            aria-pressed={isSelected}
            aria-label={displayTitle}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={{ isSelected, is720p }}
            onClick={() => handleSelect(index)}
            transition={transition}
            className={cn(
              "group relative flex items-center justify-center rounded-full text-[0.8125rem] font-medium transition-colors duration-300",
              // Keep a 48px target while the Projects surface scales to 0.97.
              "min-h-[50px] min-w-[50px]",
              "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-current",
              is720p ? "py-2" : "py-3",
              // Horizontal padding is handled by variants
              selected === index
                ? "bg-[var(--pill-active-bg)] text-[var(--pill-active-text)]"
                : isLight
                  ? "text-black/60 hover:bg-black/5 hover:text-black"
                  : "text-white/70 hover:bg-white/5 hover:text-white/95"
            )}
            style={
              selected !== index && isLight
                ? { color: 'rgba(0, 0, 0, 0.6)' }
                : undefined
            }
          >
            <Icon 
              size={is720p ? 18 : 20} // Slightly smaller icon for 720p
              aria-hidden="true"
              focusable="false"
              style={
                selected !== index && isLight
                  ? { color: 'rgba(0, 0, 0, 0.6)', stroke: 'rgba(0, 0, 0, 0.6)' }
                  : undefined
              }
            />
            <AnimatePresence initial={false}>
              {selected === index && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {displayTitle}
                </motion.span>
              )}
            </AnimatePresence>
            {!isSelected && (
              // An icon alone cannot say "Graphics & Algorithms": name it on hover and keyboard
              // focus, beside the rail rather than in it, so pointing along the row moves nothing.
              // Arbitrary `.group` variants: this build's Tailwind emits no `group-*` rules.
              <span
                aria-hidden="true"
                data-tab-hint=""
                className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--pill-active-bg)] px-2.5 py-1 text-xs font-medium text-[var(--pill-active-text)] opacity-0 shadow-sm transition-opacity duration-150 [.group:hover_&]:opacity-100 [.group:focus-visible_&]:opacity-100 motion-reduce:transition-none"
              >
                {displayTitle}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
