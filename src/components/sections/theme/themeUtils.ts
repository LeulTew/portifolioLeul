import { Theme } from './ThemeContext';

export function getInitialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage) {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    // Default to light mode on initial visit
    return 'light';
  }
  return 'light';
}
