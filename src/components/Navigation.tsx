import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';
import { useActiveSection } from '@/lib/scroll/useActiveSection';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';
import { cachedElement } from '@/lib/dom/cachedElement';

const SECTION_IDS = ['home', 'about', 'skills', 'projects', 'contact'] as const;

/* Resolved once each: `checkIsContrary` runs on every frame in light mode. */
const findSkills = cachedElement(() => document.getElementById('skills'));
const findAbout = cachedElement(() => document.getElementById('about'));
const findEducation = cachedElement(() =>
  document.querySelector<HTMLElement>('#about [data-green-bg="true"]')
);

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

  if (document.documentElement.getAttribute('data-nav-contrast') === 'true') return true;

  // If Skills section has reached or passed under the navbar,
  // we are no longer over About.
  const skillsEl = findSkills();
  if (skillsEl) {
    const skillsRect = skillsEl.getBoundingClientRect();
    if (skillsRect.top <= 80) {
      return false;
    }
  }

  const aboutEl = findAbout();
  if (!aboutEl) {
    return false;
  }

  const aboutRect = aboutEl.getBoundingClientRect();
  // Physically over About: top is at or above navbar (<= 80) and bottom is below navbar (> 80)
  const isOverAbout = aboutRect.top <= 80 && aboutRect.bottom > 80;

  if (isOverAbout) {
    /*
     * `data-nav-contrast` is measured, not scheduled.
     *
     * It says whether the chapter's green has actually climbed as far as the
     * bar, asked of the pixel grid on the frame it is asked. What it replaced
     * -- `data-bg-transition`, and `data-navbar-contrary` alongside it -- is
     * published when the rise is 95% done, and the bar sits at the very top of
     * the screen, which is the LAST place a wall climbing from the bottom
     * reaches. So the bar spent almost the entire climb dark on green.
     *
     * `data-navbar-contrary` is deliberately not consulted any more. It has
     * accumulated a second job inside About -- a dozen rules key the held
     * copy's colour off it -- and a flag meaning two things cannot be made
     * accurate for either.
     */
    if (document.documentElement.getAttribute('data-nav-contrast') === 'true') {
      return true;
    }

    const eduEl = findEducation();
    const eduRect = eduEl?.getBoundingClientRect();
    if (eduRect && eduRect.top <= 80 && eduRect.bottom > 80) {
      return true;
    }
  }

  return false;
}

export function Navigation({ scrollToSection }: NavigationProps) {
  // Chosen by how much of the focus band each section fills, in pixels: the
  // previous threshold-on-ratio approach could never activate About or
  // Projects, which are both taller than the band can ever be a 0.15 fraction
  // of. See useActiveSection.
  const trackedSection = useActiveSection(SECTION_IDS);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const activeSection = pinnedSection ?? trackedSection;
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => soundFx.getSoundEnabled());

  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'light';
  const toggleTheme = themeContext?.toggleTheme || (() => {});

  const handleToggleSound = () => {
    const next = soundFx.toggleMute();
    setIsSoundEnabled(next);
  };

  const handleNavClick = (id: string, index: number = 0) => {
    soundFx.playTabHum(index);
    scrollToSection(id);
    // Show the destination immediately, then hand back to live tracking once
    // the smooth scroll has actually arrived.
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
    const updateContrary = () => {
      setIsContrary(checkIsContrary(theme));
    };

    updateContrary();
    const unsubscribeScroll = subscribeScrollProgress(updateContrary);
    window.addEventListener('scroll', updateContrary, { passive: true });
    window.addEventListener('resize', updateContrary);

    const aboutEl = document.getElementById('about');
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(updateContrary);
      if (aboutEl) {
        observer.observe(aboutEl, {
          attributes: true,
          attributeFilter: ['data-bg-transition'],
        });
      }
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-nav-contrast', 'data-theme'],
      });
    }

    return () => {
      unsubscribeScroll();
      window.removeEventListener('scroll', updateContrary);
      window.removeEventListener('resize', updateContrary);
      observer?.disconnect();
    };
  }, [theme, activeSection]);

  const handleThemeToggle = () => {
    soundFx.playLaserClick(700);
    toggleTheme();
  };

  return (
    <header
      className={`${styles.header} ${isContrary ? styles.contraryHeader : ''}`}
      data-contrary={isContrary ? 'true' : undefined}
    >
      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.logo}
          aria-label="Home logo link"
          onClick={() => handleNavClick('home', 0)}
        >
          LT
        </button>

        {/* Desktop Navigation - Unified Toolbar Cut Out */}
        <div className={styles.desktopNav}>
          <div className={styles.navBar}>
            <div className={styles.navBarInner}>
              <div className={styles.navItems}>
                {menuItems.map((item, index) => (
                  <button
                    key={item.id}
                    className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
                    onClick={() => handleNavClick(item.id, index)}
                    aria-current={activeSection === item.id ? 'page' : undefined}
                  >
                    {item.label}
                    {activeSection === item.id && (
                      <motion.div
                        className={styles.activeIndicator}
                        layoutId="activeIndicator"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className={styles.divider} aria-hidden="true" />

              <div className={styles.utilityControls}>
                <button 
                  className={styles.themeToggle}
                  onClick={handleToggleSound}
                  aria-label={isSoundEnabled ? "Mute audio FX" : "Enable audio FX"}
                  title={isSoundEnabled ? "Audio FX: Enabled (Click to mute)" : "Audio FX: Muted (Click to enable)"}
                >
                  {isSoundEnabled ? (
                    <Volume2 size={18} className={styles.soundActiveIcon} />
                  ) : (
                    <VolumeX size={18} className={styles.soundMutedIcon} />
                  )}
                </button>

                <button 
                  className={styles.themeToggle}
                  onClick={handleThemeToggle}
                  aria-label="Toggle theme"
                  title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}