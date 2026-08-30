import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { Navigation } from './Navigation';
import { ThemeContext } from './sections/theme/ThemeContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  global.IntersectionObserver = vi.fn(function(this: IntersectionObserver) {
    this.observe = mockObserve;
    this.disconnect = mockDisconnect;
    this.takeRecords = vi.fn();
    this.unobserve = vi.fn();
  }) as unknown as typeof IntersectionObserver;
  
  // Mock getElementById
  vi.spyOn(document, 'getElementById').mockImplementation((id) => {
    const el = document.createElement('div');
    el.id = id;
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // Reset window properties
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, writable: true });
});

describe('Navigation Branch Coverage', () => {
  it('handles theme toggle icon rendering', () => {
    const toggleTheme = vi.fn();
    
    // Test Light Mode
    const { rerender } = render(
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme }}>
        <Navigation scrollToSection={vi.fn()} />
      </ThemeContext.Provider>
    );
    
    // Should show Moon icon (for switching to dark)
    // Lucide icons render as SVGs. We can check for the presence of specific attributes or class names if we knew them,
    // or just snapshot, or check if the toggle button contains the icon.
    // The code is: {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    
    // Let's just check that the button exists and we can click it
    const toggleBtn = screen.getAllByLabelText('Toggle theme')[0];
    fireEvent.click(toggleBtn);
    expect(toggleTheme).toHaveBeenCalled();

    // Test Dark Mode
    rerender(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme }}>
        <Navigation scrollToSection={vi.fn()} />
      </ThemeContext.Provider>
    );
    
    // Just ensuring no crash and button is still there
    expect(screen.getAllByLabelText('Toggle theme')[0]).toBeInTheDocument();
  });

  it('does not react to window scroll at all', () => {
    render(<Navigation scrollToSection={vi.fn()} />);

    // The page scrolls inside the ScrollControls element, so window scroll is
    // never the signal here. Firing it must change nothing.
    Object.defineProperty(window, 'scrollY', { value: 5000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 500, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1500, writable: true });

    fireEvent.scroll(window);

    expect(screen.getByText('Contact').closest('button')).not.toHaveClass('active');
    expect(screen.getByText('Home').closest('button')).toHaveClass('active');
  });

  it('handles IntersectionObserver updates', async () => {
    render(<Navigation scrollToSection={vi.fn()} />);

    // Get the observer callback
    const observerCallback = (global.IntersectionObserver as unknown as { mock: { calls: Array<[IntersectionObserverCallback]> } }).mock.calls[0][0];

    // 1. Test with no intersecting entries
    const mockObserver = {} as IntersectionObserver;
    act(() => {
      observerCallback([], mockObserver);
    });

    // 2. Test with intersecting entry (different ID)
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRect: { height: 260 }, target: { id: 'about' } } as unknown as IntersectionObserverEntry
      ], mockObserver);
    });
    // Should update to 'about'
    await waitFor(() => {
      expect(screen.getByText('About').closest('button')).toHaveClass('active');
    });

    // 3. Test with intersecting entry (SAME ID) - covers the 'prev === visibleEntry.target.id' branch
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRect: { height: 260 }, target: { id: 'about' } } as unknown as IntersectionObserverEntry
      ], mockObserver);
    });
    // Should still be 'about'
    expect(screen.getByText('About').closest('button')).toHaveClass('active');
    
    // 4. Test with multiple entries, picking the one with highest ratio
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRect: { height: 90 }, target: { id: 'skills' } } as unknown as IntersectionObserverEntry,
        { isIntersecting: true, intersectionRect: { height: 300 }, target: { id: 'projects' } } as unknown as IntersectionObserverEntry
      ], mockObserver);
    });
    // Should update to 'projects'
    expect(screen.getByText('Projects').closest('button')).toHaveClass('active');
  });
});

// Mock CSS modules
vi.mock('./Navigation.module.css', () => ({
  default: {
    header: 'header',
    scrolled: 'scrolled',
    nav: 'nav',
    logo: 'logo',
    desktopNav: 'desktopNav',
    navItems: 'navItems',
    navItem: 'navItem',
    active: 'active', // This is what we want
    activeIndicator: 'activeIndicator',
    themeToggle: 'themeToggle',
    mobileControls: 'mobileControls',
    menuToggle: 'menuToggle',
    mobileMenu: 'mobileMenu',
    mobileNavItem: 'mobileNavItem',
  },
}));
