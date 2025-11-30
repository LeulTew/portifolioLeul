import { render } from '@testing-library/react';
import { useTheme } from './useTheme';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock React to control useContext
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: (context: any) => {
      // If it's our ThemeContext (we can't easily check identity here due to mocks),
      // but we can check if we want to force an error.
      // Actually, for this test file, we ONLY want to test the error case.
      return null;
    },
  };
});

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      render() {
        if (this.state.hasError) {
          return <div>Error: {this.state.error?.message}</div>;
        }
        return this.props.children;
      }
    }

    const TestComponent = () => {
      useTheme();
      return null;
    };

    const { getByText } = render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(getByText('Error: useTheme must be used within a ThemeProvider')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });
});
