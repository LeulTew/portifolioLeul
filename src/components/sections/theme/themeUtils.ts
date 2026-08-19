import { Theme } from './ThemeContext';

export function getInitialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage) {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme as Theme;
    }
    // Default to dark mode for all supported devices (Desktop and Tablet)
    return 'dark';
  }
  return 'dark';
}
