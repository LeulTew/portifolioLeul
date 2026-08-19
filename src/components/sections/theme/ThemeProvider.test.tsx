import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider';
import { getInitialTheme } from './themeUtils';
import { useTheme } from './useTheme';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const TestConsumer = () => {
  const { theme } = useTheme();
  return <span data-testid="theme">{theme}</span>;
};

const TestToggleComponent = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('provides default dark theme', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('toggles theme correctly', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestToggleComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    const button = screen.getByRole('button', { name: 'Toggle Theme' });
    await user.click(button);

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(button);

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('persists theme in localStorage', async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <TestToggleComponent />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: 'Toggle Theme' });
    await user.click(button);

    expect(localStorageMock.getItem('theme')).toBe('light');
  });

  it('loads saved theme from localStorage', () => {
    localStorageMock.setItem('theme', 'light');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleError.mockRestore();
  });

  it('can be used within ThemeProvider', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toBeInTheDocument();
  });
});

describe('getInitialTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorageMock.clear();
  });

  it('returns "dark" when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined);
    expect(getInitialTheme()).toBe('dark');
  });

  it('returns saved theme from localStorage', () => {
    localStorageMock.setItem('theme', 'light');
    expect(getInitialTheme()).toBe('light');
  });

  it('returns "dark" for mobile devices when no theme is saved (since they are redirected)', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );
    expect(getInitialTheme()).toBe('dark');
  });

  it('returns "dark" for desktop devices when no theme is saved', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    );
    expect(getInitialTheme()).toBe('dark');
  });
});