import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';

describe('ThemeContext', () => {
  it('is created with undefined default value to enforce ThemeProvider usage', () => {
    const { result } = renderHook(() => useContext(ThemeContext));
    expect(result.current).toBeUndefined();
  });
});
