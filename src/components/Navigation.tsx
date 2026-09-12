import { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Volume2, VolumeX } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';
import { soundFx } from '@/lib/gateways/soundFx';
import { useActiveSection } from '@/lib/scroll/useActiveSection';
import { ChapterInkLayer, InkLabel } from './ui/ChapterInkLayer/ChapterInkLayer';

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

export function Navigation({ scrollToSection }: NavigationProps) {
  // Chosen by how much of the focus band each section fills, in pixels: the
  // previous threshold-on-ratio approach could never activate About or
  // Projects, which are both taller than the band can ever be a 0.15 fraction
  // of. See useActiveSection.
  const trackedSection = useActiveSection(SECTION_IDS);
  const [pinnedSection, setPinnedSection] = useState<string | null>(null);
  const activeSection = pinnedSection ?? trackedSection;
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => soundFx.getSoundEnabled());
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

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

  const controlInk = (id: string, painted: boolean) => ({
    'data-ink-control': id,
    'data-focus-visible': painted && focusedControl === id ? 'true' : undefined,
    tabIndex: painted ? -1 : undefined,
  });

  const paint = (painted: boolean) => (
    <header
      className={`${styles.header} ${painted ? styles.painted : ''}`}
      onFocusCapture={painted ? undefined : event => {
        const button = event.target;
        if (button instanceof HTMLButtonElement) {
          setFocusedControl(button.matches(':focus-visible') ? button.dataset.inkControl ?? null : null);
        }
      }}
      onBlurCapture={painted ? undefined : () => setFocusedControl(null)}
      onPointerDownCapture={painted ? undefined : () => setFocusedControl(null)}
    >
      <nav className={styles.nav}>
        <button
          type="button"
          className={styles.logo}
          aria-label={painted ? undefined : 'Home logo link'}
          {...controlInk('logo', painted)}
          onClick={painted ? undefined : () => handleNavClick('home', 0)}
        >
          <InkLabel text="LT" painted={painted} />
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
                    {...controlInk(item.id, painted)}
                    onClick={painted ? undefined : () => handleNavClick(item.id, index)}
                    aria-current={!painted && activeSection === item.id ? 'page' : undefined}
                  >
                    <InkLabel text={item.label} painted={painted} />
                    {activeSection === item.id && (
                      <motion.div
                        className={styles.activeIndicator}
                        layoutId={painted ? 'paintedActiveIndicator' : 'activeIndicator'}
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
                  {...controlInk('sound', painted)}
                  onClick={painted ? undefined : handleToggleSound}
                  aria-label={painted ? undefined : isSoundEnabled ? "Mute audio FX" : "Enable audio FX"}
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
                  {...controlInk('theme', painted)}
                  onClick={painted ? undefined : handleThemeToggle}
                  aria-label={painted ? undefined : 'Toggle theme'}
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

  return <>
    {paint(false)}
    <ChapterInkLayer className={styles.inkLayer}>{paint(true)}</ChapterInkLayer>
  </>;
}