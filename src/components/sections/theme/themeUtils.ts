
import { Theme } from './ThemeContext';

/*
 * Storage can be denied outright -- blocked site data, sandboxed frames -- and
 * reading it then throws. The inline bootstrap in index.html already guards
 * this; the app must not crash where that script carried on.
 */
export function getInitialTheme(): Theme {
  try {
    const savedTheme = typeof window === 'undefined' ? null : window.localStorage.getItem('theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Remembers the choice when storage allows it; the theme applies either way. */
export function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem('theme', theme);
  } catch {
    // Denied storage only costs the preference on the next visit.
  }
}
