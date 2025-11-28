import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

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