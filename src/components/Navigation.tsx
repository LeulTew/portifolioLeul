import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';

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

export function Navigation({ scrollToSection }: NavigationProps) {
  const [activeSection, setActiveSection] = useState('home');
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => soundFx.getSoundEnabled());

  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'dark';
  const toggleTheme = themeContext?.toggleTheme || (() => {});

  const handleToggleSound = () => {
    const next = soundFx.toggleMute();
    setIsSoundEnabled(next);
  };

  useEffect(() => {
    // The page scrolls inside the ScrollControls element, so window.scrollY and
    // documentElement.scrollHeight are always 0 here. IntersectionObserver is
    // the only reliable signal, and it does account for the container's
    // transform -- including at the very bottom, where Contact fills the band.
    let observer: IntersectionObserver | null = null;
    let retryId: number | null = null;

    const initObserver = () => {
      const sections = menuItems
        .map(({ id }) => document.getElementById(id))
        .filter((section): section is HTMLElement => Boolean(section));

      if (!sections.length) {
        retryId = window.setTimeout(initObserver, 250);
        return;
      }

      if (retryId) {
        window.clearTimeout(retryId);
        retryId = null;
      }

      observer = new IntersectionObserver(
        entries => {
          const visibleEntry = entries
            .filter(entry => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (visibleEntry?.target?.id) {
            setActiveSection(prev => (prev === visibleEntry.target.id ? prev : visibleEntry.target.id));
          }
        },
        {
          root: null,
          threshold: [0.15, 0.35, 0.55],
          rootMargin: '-35% 0px -35% 0px',
        }
      );

      sections.forEach(section => observer?.observe(section));
    };

    initObserver();

    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (retryId) window.clearTimeout(retryId);
    };
  }, []);

  const handleNavClick = (id: string, index: number = 0) => {
    soundFx.playTabHum(index);
    scrollToSection(id);
    setActiveSection(id);
  };

  const handleThemeToggle = () => {
    soundFx.playLaserClick(700);
    toggleTheme();
  };

  return (
    <header className={styles.header}>
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