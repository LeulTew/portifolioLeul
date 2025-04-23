import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { Theme } from './ThemeProvider';

interface UseThemeReturn {
  theme: Theme;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
} 