import { renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';
import { describe, it, expect, vi } from 'vitest';

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    // Suppress console.error for this test as React logs the error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      renderHook(() => useTheme());
    } catch (error: unknown) {
      expect((error as Error).message).toBe('useTheme must be used within a ThemeProvider');
    }
    
    consoleSpy.mockRestore();
  });
});
