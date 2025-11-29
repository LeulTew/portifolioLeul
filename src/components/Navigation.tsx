import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon } from 'lucide-react';
import styles from './Navigation.module.css';
import { ThemeContext } from './sections/theme/ThemeContext';

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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useContext(ThemeContext);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
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
          // Check if we are at the bottom of the page
          const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
          
          if (isAtBottom) {
            setActiveSection('contact');
            return;
          }

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
      
      // Also add a scroll listener to check for bottom
      const handleScrollCheck = () => {
        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100;
        if (isAtBottom) {
          setActiveSection('contact');
        }
      };
      window.addEventListener('scroll', handleScrollCheck);
      
      // Store the listener cleanup
      (observer as any)._scrollHandler = handleScrollCheck;
    };

    initObserver();

    return () => {
      if (observer) {
        window.removeEventListener('scroll', (observer as any)._scrollHandler);
        observer.disconnect();
      }
      if (retryId) window.clearTimeout(retryId);
    };
  }, []);

  const handleNavClick = (id: string) => {
    scrollToSection(id);
    setActiveSection(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      <nav className={styles.nav}>
        <div 
          className={styles.logo}
          onClick={() => handleNavClick('home')}
        >
          LT
        </div>

        {/* Desktop Navigation */}
        <div className={styles.desktopNav}>
          <div className={styles.navItems}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
                onClick={() => handleNavClick(item.id)}
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
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Mobile Navigation Controls */}
        <div className={styles.mobileControls}>
          <button 
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            className={styles.menuToggle}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              className={styles.mobileMenu}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.mobileNavItem} ${activeSection === item.id ? styles.active : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}