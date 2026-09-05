import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';
import { useActiveSection } from '@/lib/scroll/useActiveSection';
import { subscribeScrollProgress, getScrollProgress } from '@/lib/scroll/scrollProgress';

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);
  return prefersReduced;
}

const SECTION_IDS = ['home', 'about', 'skills', 'projects', 'contact'] as const;

const menuItems = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'contact', label: 'Contact' }
];

interface NavigationProps {
  scrollToSection: (id: string) => void;
}

function checkIsContrary(theme: string): boolean {
  if (theme !== 'light' || typeof document === 'undefined') {
    return false;
  }

  const aboutEl = document.getElementById('about');
  if (!aboutEl) {
    return false;
  }

  const aboutRect = aboutEl.getBoundingClientRect();
  const isOverAbout = aboutRect.top <= 80 && aboutRect.bottom >= 20;

  if (isOverAbout) {
    const isTransitioned =
      aboutEl.getAttribute('data-bg-transition') === 'true' ||
      document.documentElement.getAttribute('data-navbar-contrary') === 'true';
    const eduEl = aboutEl.querySelector('[data-green-bg="true"]');
    const eduRect = eduEl?.getBoundingClientRect();
    const inEdu = eduRect ? eduRect.top <= 80 && eduRect.bottom >= 20 : false;

    if (isTransitioned || inEdu) {
      return true;
    }
  }

  return false;
}

export function Navigation({ scrollToSection }: NavigationProps) {
  const trackedSection = useActiveSection(SECTION_IDS);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const activeSection = pinnedSection ?? trackedSection;
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => soundFx.getSoundEnabled());
  const [isScrolled, setIsScrolled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getScrollProgress() > 0.005 || window.scrollY > 20;
  });
  const shouldReduceMotion = usePrefersReducedMotion();

  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'dark';
  const toggleTheme = themeContext?.toggleTheme || (() => {});

  const handleToggleSound = () => {
    const next = soundFx.toggleMute();
    setIsSoundEnabled(next);
  };

  const handleNavClick = (id: string, index: number = 0) => {
    soundFx.playTabHum(index);
    scrollToSection(id);
    setPinnedSection(id);
  };

  const [isContrary, setIsContrary] = useState(() => checkIsContrary(theme));

  useEffect(() => {
    if (pinnedSection === null) return;
    if (trackedSection === pinnedSection) {
      setPinnedSection(null);
      return;
    }
    const release = setTimeout(() => setPinnedSection(null), 1200);
    return () => clearTimeout(release);
  }, [pinnedSection, trackedSection]);

  useEffect(() => {
    const updateHeaderState = () => {
      setIsContrary(checkIsContrary(theme));
      const prog = getScrollProgress();
      setIsScrolled(prog > 0.005 || (typeof window !== 'undefined' && window.scrollY > 20));
    };

    updateHeaderState();
    const unsubscribeScroll = subscribeScrollProgress((p) => {
      setIsScrolled(p > 0.005 || (typeof window !== 'undefined' && window.scrollY > 20));
      updateHeaderState();
    });

    const handleWinScroll = () => {
      setIsScrolled(getScrollProgress() > 0.005 || window.scrollY > 20);
      updateHeaderState();
    };

    window.addEventListener('scroll', handleWinScroll, { passive: true });
    window.addEventListener('resize', updateHeaderState);

    const aboutEl = document.getElementById('about');
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(updateHeaderState);
      if (aboutEl) {
        observer.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-transition'],
        });
      }
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-navbar-contrary', 'data-theme'],
      });
    }

    return () => {
      unsubscribeScroll();
      window.removeEventListener('scroll', handleWinScroll);
      window.removeEventListener('resize', updateHeaderState);
      observer?.disconnect();
    };
  }, [theme, activeSection]);

  const handleThemeToggle = () => {
    soundFx.playLaserClick(700);
    toggleTheme();
  };

  return (
    <header
      className={`${styles.header} ${isScrolled ? styles.scrolled : ''} ${isContrary ? styles.contraryHeader : ''}`}
      data-contrary={isContrary ? 'true' : undefined}
      data-scrolled={isScrolled ? 'true' : undefined}
    >
      <nav className={styles.nav} aria-label="Main Navigation">
        <button
          type="button"
          className={styles.logo}
          aria-label="Navigate to home"
          onClick={() => handleNavClick('home', 0)}
        >
          <span className={styles.logoBadge}>LT</span>
        </button>

        {/* Unified Desktop / Responsive Navigation Toolbar */}
        <div className={styles.desktopNav}>
          <div className={styles.navBar}>
            <div className={styles.navBarInner}>
              <ul className={styles.navItems} role="list">
                {menuItems.map((item, index) => (
                  <li key={item.id} className={styles.navItemWrapper}>
                    <button
                      type="button"
                      className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
                      onClick={() => handleNavClick(item.id, index)}
                      aria-current={activeSection === item.id ? 'page' : undefined}
                    >
                      <span className={styles.navLabel}>{item.label}</span>
                      {activeSection === item.id && (
                        <motion.div
                          className={styles.activeIndicator}
                          layoutId={shouldReduceMotion ? undefined : "activeIndicator"}
                          transition={
                            shouldReduceMotion
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 420, damping: 32 }
                          }
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <div className={styles.divider} aria-hidden="true" />

              <div className={styles.utilityControls}>
                <button 
                  type="button"
                  className={styles.themeToggle}
                  onClick={handleToggleSound}
                  aria-label={isSoundEnabled ? "Mute audio FX" : "Enable audio FX"}
                  title={isSoundEnabled ? "Audio FX: Enabled (Click to mute)" : "Audio FX: Muted (Click to enable)"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isSoundEnabled ? (
                      <motion.div
                        key="sound-on"
                        initial={shouldReduceMotion ? false : { scale: 0.65, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { scale: 0.65, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className={styles.iconWrapper}
                      >
                        <Volume2 size={18} className={styles.soundActiveIcon} aria-hidden="true" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="sound-off"
                        initial={shouldReduceMotion ? false : { scale: 0.65, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { scale: 0.65, opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className={styles.iconWrapper}
                      >
                        <VolumeX size={18} className={styles.soundMutedIcon} aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                <button 
                  type="button"
                  className={styles.themeToggle}
                  onClick={handleThemeToggle}
                  aria-label="Toggle theme"
                  title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {theme === 'dark' ? (
                      <motion.div
                        key="dark-sun"
                        initial={shouldReduceMotion ? false : { rotate: -90, scale: 0.65, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { rotate: 90, scale: 0.65, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={styles.iconWrapper}
                      >
                        <Sun size={18} aria-hidden="true" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="light-moon"
                        initial={shouldReduceMotion ? false : { rotate: -90, scale: 0.65, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={shouldReduceMotion ? undefined : { rotate: 90, scale: 0.65, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className={styles.iconWrapper}
                      >
                        <Moon size={18} aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}