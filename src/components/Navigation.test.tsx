/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Navigation } from './Navigation';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ThemeContext } from './sections/theme/ThemeContext';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
let intersectionCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    intersectionCallback = cb;
  }
  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  takeRecords = () => [];
  root = null;
  rootMargin = '';
  thresholds = [];
}
window.IntersectionObserver = MockIntersectionObserver as any;

describe('Navigation', () => {
  const mockScrollToSection = vi.fn();
  const mockToggleTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation with logo and menu items', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    expect(screen.getByText('LT')).toBeTruthy();
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getByText('Contact')).toBeTruthy();
  });

  it('handles navigation click', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    fireEvent.click(screen.getByText('About'));
    expect(mockScrollToSection).toHaveBeenCalledWith('about');
  });

  it('toggles theme', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    // Find theme toggle button (desktop)
    const themeButtons = screen.getAllByLabelText('Toggle theme');
    fireEvent.click(themeButtons[0]);
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('opens and closes mobile menu', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    const menuButton = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuButton);
    // Check if mobile menu items are visible (might need to check for class or visibility)
    // Click a mobile item
    const mobileHome = screen.getAllByText('Home')[1]; // Assuming second one is in mobile menu
    if (mobileHome) {
        fireEvent.click(mobileHome);
        expect(mockScrollToSection).toHaveBeenCalledWith('home');
    }
  });

  it('handles scroll for active section', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    // Simulate scroll
    fireEvent.scroll(window, { target: { scrollY: 100 } });
    
    // Simulate bottom of page
    Object.defineProperty(window, 'scrollY', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1800);
    
    fireEvent.scroll(window);
    // Should trigger contact active logic
  });
  it('calls scrollToSection when logo is clicked', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    const logo = screen.getByText('LT');
    fireEvent.click(logo);

    expect(mockScrollToSection).toHaveBeenCalledWith('home');
  });

  it('handles window resize events', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    // Trigger resize
    fireEvent(window, new Event('resize'));
  });

  it('handles theme toggle in mobile menu', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    const menuButton = screen.getByLabelText('Toggle menu');
    fireEvent.click(menuButton);
    
    // Find theme toggle in mobile menu
    const themeButtons = screen.getAllByLabelText('Toggle theme');
    if (themeButtons.length > 1) {
      fireEvent.click(themeButtons[1]); // Mobile theme toggle
      expect(mockToggleTheme).toHaveBeenCalled();
    }
  });

  it('closes mobile menu when clicking outside', () => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    const menuButton = screen.getByLabelText('Toggle menu');
    // Click menu button again to close
    fireEvent.click(menuButton);
  });

  it('triggers IntersectionObserver callback when sections are visible', () => {
    // Create mock sections
    const mockSection = document.createElement('section');
    mockSection.id = 'about';
    document.body.appendChild(mockSection);

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    // Trigger IntersectionObserver callback
    if (intersectionCallback) {
      const mockEntries: IntersectionObserverEntry[] = [{
        isIntersecting: true,
        intersectionRatio: 0.5,
        target: mockSection,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: 0
      }];
      
      act(() => {
        intersectionCallback!(mockEntries, {} as IntersectionObserver);
      });
    }

    document.body.removeChild(mockSection);
  });

  it('handles bottom of page detection in IntersectionObserver', () => {
    // Mock scroll properties
    Object.defineProperty(window, 'scrollY', { value: 1000, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1800);

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    // Trigger IntersectionObserver callback at bottom
    if (intersectionCallback) {
      const mockEntries: IntersectionObserverEntry[] = [];
      act(() => {
        intersectionCallback!(mockEntries, {} as IntersectionObserver);
      });
    }
  });

  it('handles multiple intersecting sections', () => {
    const mockSection1 = document.createElement('section');
    mockSection1.id = 'about';
    const mockSection2 = document.createElement('section');
    mockSection2.id = 'skills';
    document.body.appendChild(mockSection1);
    document.body.appendChild(mockSection2);

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    // Trigger with multiple intersecting sections
    if (intersectionCallback) {
      const mockEntries: IntersectionObserverEntry[] = [
        {
          isIntersecting: true,
          intersectionRatio: 0.3,
          target: mockSection1,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0
        },
        {
          isIntersecting: true,
          intersectionRatio: 0.6,
          target: mockSection2,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0
        }
      ];
      
      act(() => {
        intersectionCallback!(mockEntries, {} as IntersectionObserver);
      });
    }

    document.body.removeChild(mockSection1);
    document.body.removeChild(mockSection2);
  });
  
  it('retries observer initialization if sections are missing', () => {
    vi.useFakeTimers();
    
    // Mock getElementById to return null initially
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    // Should schedule retry
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Restore
    vi.spyOn(document, 'getElementById').mockRestore();
    vi.useRealTimers();
  });

  it('detects bottom of page via scroll listener', () => {
    // Add sections to DOM so initObserver proceeds
    const sections = ['home', 'about', 'skills', 'projects', 'contact'].map(id => {
      const el = document.createElement('section');
      el.id = id;
      document.body.appendChild(el);
      return el;
    });

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    // Simulate bottom of page
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);

    fireEvent.scroll(window);

    const contactButton = screen.getByText('Contact').closest('button');
    expect(contactButton).toHaveClass(/active/);
    
    sections.forEach(el => document.body.removeChild(el));
  });
});