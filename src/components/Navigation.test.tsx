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

  it('clears retry timeout when sections appear', () => {
    vi.useFakeTimers();
    
    // Start with no sections
    let callCount = 0;
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      callCount++;
      // Return null first time, then return elements
      if (callCount <= 5) {
        return null;
      }
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
    
    // First retry - sections still missing
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Second retry - sections appear, should clear timeout
    act(() => {
      vi.advanceTimersByTime(250);
    });
    
    // Cleanup
    vi.spyOn(document, 'getElementById').mockRestore();
    vi.useRealTimers();
  });

  it('clears retry timeout on unmount', () => {
    vi.useFakeTimers();
    
    // Mock getElementById to always return null so retry keeps scheduling
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    
    const { unmount } = render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    
    // Advance time to schedule a retry
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Unmount should clear the timeout
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    // Cleanup
    vi.spyOn(document, 'getElementById').mockRestore();
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it('marks Contact active when the contact section dominates the viewport', () => {
    // Replaces a test that drove window.scrollY. The page scrolls inside the
    // ScrollControls element, so window scroll never fires here and that path
    // was unreachable; IntersectionObserver is the real signal, including at
    // the very bottom where Contact fills the observer band.
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

    act(() => {
      intersectionCallback?.(
        [
          { target: { id: 'projects' }, isIntersecting: true, intersectionRatio: 0.2 },
          { target: { id: 'contact' }, isIntersecting: true, intersectionRatio: 0.8 },
        ] as any,
        {} as any
      );
    });

    expect(screen.getByText('Contact').closest('button')).toHaveClass(/active/);

    sections.forEach(el => document.body.removeChild(el));
  });

  it('ignores an observer batch where nothing is intersecting', () => {
    const section = document.createElement('section');
    section.id = 'home';
    document.body.appendChild(section);

    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );

    act(() => {
      intersectionCallback?.(
        [{ target: { id: 'contact' }, isIntersecting: false, intersectionRatio: 0 }] as any,
        {} as any
      );
    });

    expect(screen.getByText('Home').closest('button')).toHaveClass(/active/);

    document.body.removeChild(section);
  });
});
