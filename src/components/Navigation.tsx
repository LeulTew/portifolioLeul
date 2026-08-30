import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';
import { useActiveSection } from '@/lib/scroll/useActiveSection';

/*
 * Every section on the page, in order. Education is here as well as in the
 * menu: the active item is chosen from what is on screen, so a section left
 * out of this list leaves the previous one highlighted for as long as the
 * reader spends in it.
 */
const SECTION_IDS = [
  'home',
  'about',
  'education',
  'skills',
  'projects',
  'contact',
] as const;

const menuItems = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'contact', label: 'Contact' }
];

interface NavigationProps {
  scrollToSection: (id: string) => void;
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

  useEffect(() => {
    if (pinnedSection === null) return;
    if (trackedSection === pinnedSection) {
      setPinnedSection(null);
      return;
    }
    const release = setTimeout(() => setPinnedSection(null), 1200);
    return () => clearTimeout(release);
  }, [pinnedSection, trackedSection]);

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