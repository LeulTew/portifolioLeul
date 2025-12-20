import { Theme } from './ThemeContext';

export function getInitialTheme(): Theme {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme as Theme;
    }
    // Default to light mode on Mobile, dark mode on Desktop
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    return isMobile ? 'light' : 'dark';
  }
  return 'dark';
}
