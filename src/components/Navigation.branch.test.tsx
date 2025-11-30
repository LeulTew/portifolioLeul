import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { Navigation } from './Navigation';
import { ThemeContext } from './sections/theme/ThemeContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

beforeEach(() => {
  global.IntersectionObserver = vi.fn(function(this: any, _callback: any) {
    this.observe = mockObserve;
    this.disconnect = mockDisconnect;
    this.takeRecords = vi.fn();
    this.unobserve = vi.fn();
  }) as any;
  
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

  it('handles scroll to bottom check', () => {
    render(<Navigation scrollToSection={vi.fn()} />);

    // Mock window properties to simulate bottom of page
    Object.defineProperty(window, 'scrollY', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 500, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1500, writable: true });

    // Trigger scroll event
    fireEvent.scroll(window);
    
    // Check if Contact button has the active indicator
    // The active indicator is a motion.div with layoutId="activeIndicator"
    // We can check if the Contact button contains a child that represents this.
    // Since we didn't mock framer-motion here yet, it might render as a normal div.
    // Let's look for the button that contains the indicator.
    
    // We can also check if the button has the 'active' class if we mock styles.
    // But let's try to find the indicator.
    // Or we can just check if the 'Contact' button is the one that is active.
    // Let's mock the styles to return 'active' for the active class.
    const contactLink = screen.getByText('Contact').closest('button');
    expect(contactLink).toHaveClass('active');
  });

  it('handles scroll not at bottom', () => {
    render(<Navigation scrollToSection={vi.fn()} />);

    // Mock window properties to simulate NOT bottom of page
    Object.defineProperty(window, 'scrollY', { value: 50, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 500, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1500, writable: true });

    // Trigger scroll event
    fireEvent.scroll(window);
    
    // Should NOT set active section to contact (unless it was already contact, but default is home)
    // We can check that 'Contact' is NOT active.
    const contactLink = screen.getByText('Contact').closest('button');
    expect(contactLink).not.toHaveClass('active');
  });

  it('handles IntersectionObserver updates', async () => {
    render(<Navigation scrollToSection={vi.fn()} />);

    // Get the observer callback
    const observerCallback = (global.IntersectionObserver as any).mock.calls[0][0];

    // 1. Test with no intersecting entries
    act(() => {
      observerCallback([]);
    });

    // 2. Test with intersecting entry (different ID)
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRatio: 0.8, target: { id: 'about' } }
      ]);
    });
    // Should update to 'about'
    await waitFor(() => {
      expect(screen.getByText('About').closest('button')).toHaveClass('active');
    });

    // 3. Test with intersecting entry (SAME ID) - covers the 'prev === visibleEntry.target.id' branch
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRatio: 0.8, target: { id: 'about' } }
      ]);
    });
    // Should still be 'about'
    expect(screen.getByText('About').closest('button')).toHaveClass('active');
    
    // 4. Test with multiple entries, picking the one with highest ratio
    act(() => {
      observerCallback([
        { isIntersecting: true, intersectionRatio: 0.5, target: { id: 'skills' } },
        { isIntersecting: true, intersectionRatio: 0.9, target: { id: 'projects' } }
      ]);
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
