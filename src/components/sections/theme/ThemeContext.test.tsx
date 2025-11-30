import { describe, it, expect } from 'vitest';
import { ThemeContext } from './ThemeContext';

describe('ThemeContext', () => {
  it('has default values', () => {
    // Access the default value by reading _currentValue (React internal) or by consuming it
    // Since we can't easily access internal React state in tests without rendering,
    // we can verify the object structure if it was exported as a value, but it's a Context object.
    // However, the coverage report shows the default function `() => {}` is uncovered.
    // We can test this by rendering a consumer without a provider.
    
    // Actually, we can just check the default value directly if we could access it, 
    // but the cleanest way to hit that line is to consume it.
  });
});

// Better approach: Create a test component that uses the context without a provider
import { renderHook } from '@testing-library/react';
import { useContext } from 'react';

describe('ThemeContext Default Value', () => {
  it('provides default values when used without provider', () => {
    const { result } = renderHook(() => useContext(ThemeContext));
    
    expect(result.current.theme).toBe('dark');
    
    // Call the default toggleTheme function to cover it
    expect(() => result.current.toggleTheme()).not.toThrow();
  });
});
