import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';
import { useActiveSection } from '@/lib/scroll/useActiveSection';
import { subscribeScrollProgress } from '@/lib/scroll/scrollProgress';

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
  // Chosen by how much of the focus band each section fills, in pixels: the
  // previous threshold-on-ratio approach could never activate About or
  // Projects, which are both taller than the band can ever be a 0.15 fraction
  // of. See useActiveSection.
  const trackedSection = useActiveSection(SECTION_IDS);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const activeSection = pinnedSection ?? trackedSection;
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => soundFx.getSoundEnabled());

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
        attributeFilter: ['data-navbar-contrary', 'data-theme'],
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
        <div 
          className={styles.logo}
          role="button"
          tabIndex={0}
          aria-label="Home logo link"
          onClick={() => handleNavClick('home', 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleNavClick('home', 0);
            }
          }}
        >
          LT
        </div>

        {/* Desktop Navigation */}
        <div className={styles.desktopNav}>
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
          
          <button 
            className={styles.themeToggle}
            onClick={handleToggleSound}
            aria-label={isSoundEnabled ? "Mute audio FX" : "Enable audio FX"}
            title={isSoundEnabled ? "Audio FX: Enabled (Click to mute)" : "Audio FX: Muted (Click to enable)"}
          >
            {isSoundEnabled ? <Volume2 size={19} className="text-emerald-400" /> : <VolumeX size={19} className="opacity-40" />}
          </button>

          <button 
            className={styles.themeToggle}
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </nav>
    </header>
  );
}