import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, getInitialTheme } from './ThemeProvider';
import { useTheme } from './useTheme';
import { vi } from 'vitest';

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
    localStorage.clear();
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

    await user.click(screen.getByRole('button', { name: /toggle theme/i }));

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    await user.click(screen.getByRole('button', { name: /toggle theme/i }));

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('persists theme in localStorage', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ThemeProvider>
        <TestToggleComponent />
      </ThemeProvider>
    );

    await user.click(screen.getByRole('button', { name: /toggle theme/i }));
    expect(localStorage.getItem('theme')).toBe('light');

    // Simulate page reload by re-rendering
    rerender(
      <ThemeProvider>
        <TestToggleComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
  });

  it('loads saved theme from localStorage', () => {
    localStorage.setItem('theme', 'light');

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
  const originalWindow = global.window;

  afterEach(() => {
    vi.restoreAllMocks();
    global.window = originalWindow;
    localStorage.clear();
  });

  it('returns "dark" when window is undefined (SSR)', () => {
    // @ts-ignore
    delete global.window;
    expect(getInitialTheme()).toBe('dark');
  });

  it('returns saved theme from localStorage', () => {
    localStorage.setItem('theme', 'light');
    expect(getInitialTheme()).toBe('light');
  });

  it('returns "light" for mobile devices when no theme is saved', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );
    expect(getInitialTheme()).toBe('light');
  });

  it('returns "dark" for desktop devices when no theme is saved', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    );
    expect(getInitialTheme()).toBe('dark');
  });
});