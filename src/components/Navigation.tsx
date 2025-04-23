import { useState, useEffect } from 'react';
import styles from './Navigation.module.css';

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

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      
      menuItems.forEach(({ id }) => {
        const element = document.getElementById(id);
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const top = rect.top + scrollPosition;
        const offset = window.innerHeight * 0.3;
        
        if (scrollPosition >= top - offset) {
          setActiveSection(id);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div 
          className={styles.logo}
          onClick={() => scrollToSection('home')}
        >
          LT
        </div>

        <div className={styles.navItems}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${activeSection === item.id ? styles.active : ''}`}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}