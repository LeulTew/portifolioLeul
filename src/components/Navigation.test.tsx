/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-navbar-contrary');
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
    expect(mockScrollToSection).toHaveBeenCalledWith('about', { source: 'navbar' });
  });

  it('keeps keyboard reveals below itself while it is mounted', () => {
    // Round 8: a Tab into the flat contact form parked the name field under the pill.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const height = this.tagName === 'HEADER' ? 70 : 0;
      return { top: 0, bottom: height, height, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    });
    const { unmount } = render(<Navigation scrollToSection={mockScrollToSection} />);
    expect(document.documentElement.style.scrollPaddingTop).toBe('70px');
    unmount();
    expect(document.documentElement.style.scrollPaddingTop).toBe('');
    rect.mockRestore();
  });

  it('hands focus to the destination, as an in-page link would', async () => {
    // Round 7 (D-A11Y-001): focus stayed on the navbar, so Tab went back through Home.
    const landing = document.createElement('section');
    landing.id = 'contact';
    landing.tabIndex = -1;
    landing.dataset.sectionLanding = 'contact';
    vi.spyOn(landing, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    document.body.append(landing);
    render(<Navigation scrollToSection={mockScrollToSection} />);
    const link = screen.getByRole('button', { name: 'Contact' });
    link.focus();
    fireEvent.click(link);
    expect(mockScrollToSection).toHaveBeenCalledWith('contact', { source: 'navbar' });
    await waitFor(() => expect(landing).toHaveFocus());
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

    expect(mockScrollToSection).toHaveBeenCalledWith('home', { source: 'navbar' });
  });

  it.each(['Enter', ' '])('leaves the logo activation key %j uncancelled', async (key) => {
    render(
      <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
        <Navigation scrollToSection={mockScrollToSection} />
      </ThemeContext.Provider>
    );
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    const logo = screen.getByRole('button', { name: 'Home logo link' });
    fireEvent(logo, event);
    expect(event.defaultPrevented).toBe(false);
    expect(logo.tagName).toBe('BUTTON');
    act(() => { logo.focus(); });
    await userEvent.keyboard(key === 'Enter' ? '{Enter}' : ' ');
    expect(mockScrollToSection).toHaveBeenCalledWith('home', { source: 'navbar' });
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
        intersectionRatio: 0.2,
        intersectionRect: { height: 200 } as DOMRectReadOnly,
        target: mockSection,
        boundingClientRect: {} as DOMRectReadOnly,
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
          intersectionRatio: 1,
          intersectionRect: { height: 90 } as DOMRectReadOnly,
          target: mockSection1,
          boundingClientRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0
        },
        {
          isIntersecting: true,
          intersectionRatio: 1,
          intersectionRect: { height: 240 } as DOMRectReadOnly,
          target: mockSection2,
          boundingClientRect: {} as DOMRectReadOnly,
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
          // How much of the focus band each section fills, in pixels. Not a
          // ratio of the section's own height: a section taller than twice the
          // band can never reach a ratio threshold, which is how About and
          // Projects used to be skipped entirely.
          { target: { id: 'projects' }, isIntersecting: true, intersectionRect: { height: 40 } },
          { target: { id: 'contact' }, isIntersecting: true, intersectionRect: { height: 260 } },
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
        [{ target: { id: 'contact' }, isIntersecting: false, intersectionRect: { height: 0 } }] as any,
        {} as any
      );
    });

    expect(screen.getByText('Home').closest('button')).toHaveClass(/active/);

    document.body.removeChild(section);
  });

  describe('spatial navigation ink', () => {
    it('mirrors keyboard focus without focusing the decorative controls', () => {
      render(<Navigation scrollToSection={vi.fn()} />);
      const home = screen.getByRole('button', { name: 'Home' });
      vi.spyOn(home, 'matches').mockImplementation(selector => selector === ':focus-visible');
      fireEvent.focus(home);
      const painted = document.querySelector('[data-chapter-ink-layer] [data-ink-control="home"]');
      expect(painted).toHaveAttribute('data-focus-visible', 'true');
      expect(painted).toHaveAttribute('tabindex', '-1');
      fireEvent.pointerDown(home);
      expect(painted).not.toHaveAttribute('data-focus-visible');
      fireEvent.focus(home);
      fireEvent.blur(home);
      expect(painted).not.toHaveAttribute('data-focus-visible');
    });

    it('stays dark while the rise is under way but has not reached the bar', () => {
      // Legacy phase flags must not recolor the underlying controls.
      const aboutEl = document.createElement('section');
      aboutEl.id = 'about';
      aboutEl.setAttribute('data-bg-transition', 'true');
      vi.spyOn(aboutEl, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 500,
        left: 0,
        right: 1000,
        width: 1000,
        height: 500,
      } as DOMRect);
      document.body.appendChild(aboutEl);

      render(
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: mockToggleTheme }}>
          <Navigation scrollToSection={mockScrollToSection} />
        </ThemeContext.Provider>
      );

      expect(document.querySelector('header')).not.toHaveAttribute(
        'data-contrary',
        'true'
      );

      document.body.removeChild(aboutEl);
    });

    it('keeps the real controls unchanged and adds only a non-interactive masked paint', async () => {
      document.documentElement.setAttribute('data-nav-contrast', 'true');
      const aboutEl = document.createElement('section');
      aboutEl.id = 'about';
      vi.spyOn(aboutEl, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 500,
        left: 0,
        right: 1000,
        width: 1000,
        height: 500,
      } as DOMRect);
      document.body.appendChild(aboutEl);

      render(
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: mockToggleTheme }}>
          <Navigation scrollToSection={mockScrollToSection} />
        </ThemeContext.Provider>
      );

      const header = document.querySelector('header');
      expect(header).not.toHaveAttribute('data-contrary');
      const layer = document.querySelector('[data-chapter-ink-layer]')!;
      expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(layer.querySelector('[data-ink-text="LT"]')).toBeInTheDocument();
      expect(layer.querySelector('[data-ink-text="About"]')).toBeInTheDocument();
      for (const button of layer.querySelectorAll('button')) expect(button.tabIndex).toBe(-1);
      expect(screen.getAllByRole('button', { name: 'About' })).toHaveLength(1);
      expect(screen.getAllByText('LT')).toHaveLength(1);

      await act(async () => {
        document.body.removeChild(aboutEl);
        document.documentElement.removeAttribute('data-nav-contrast');
      });
    });

    it('does not apply contrary styles in dark mode even if about has transitioned', () => {
      const aboutEl = document.createElement('section');
      aboutEl.id = 'about';
      aboutEl.setAttribute('data-bg-transition', 'true');
      vi.spyOn(aboutEl, 'getBoundingClientRect').mockReturnValue({
        top: 0,
        bottom: 500,
        left: 0,
        right: 1000,
        width: 1000,
        height: 500,
      } as DOMRect);
      document.body.appendChild(aboutEl);

      render(
        <ThemeContext.Provider value={{ theme: 'dark', toggleTheme: mockToggleTheme }}>
          <Navigation scrollToSection={mockScrollToSection} />
        </ThemeContext.Provider>
      );

      const header = document.querySelector('header');
      expect(header).not.toHaveAttribute('data-contrary');

      document.body.removeChild(aboutEl);
    });

    it('reverts to normal when about section scrolls past the navbar', () => {
      const aboutEl = document.createElement('section');
      aboutEl.id = 'about';
      aboutEl.setAttribute('data-bg-transition', 'true');
      // Positioned above the viewport (scrolled past)
      vi.spyOn(aboutEl, 'getBoundingClientRect').mockReturnValue({
        top: -1000,
        bottom: -200,
        left: 0,
        right: 1000,
        width: 1000,
        height: 800,
      } as DOMRect);
      document.body.appendChild(aboutEl);

      render(
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: mockToggleTheme }}>
          <Navigation scrollToSection={mockScrollToSection} />
        </ThemeContext.Provider>
      );

      const header = document.querySelector('header');
      expect(header).not.toHaveAttribute('data-contrary');

      document.body.removeChild(aboutEl);
    });

    it('reverts to normal when skills section arrives even if about still has data-bg-transition', () => {
      const aboutEl = document.createElement('section');
      aboutEl.id = 'about';
      aboutEl.setAttribute('data-bg-transition', 'true');
      vi.spyOn(aboutEl, 'getBoundingClientRect').mockReturnValue({
        top: -600,
        bottom: 50,
        left: 0,
        right: 1000,
        width: 1000,
        height: 650,
      } as DOMRect);
      document.body.appendChild(aboutEl);

      const skillsEl = document.createElement('section');
      skillsEl.id = 'skills';
      vi.spyOn(skillsEl, 'getBoundingClientRect').mockReturnValue({
        top: 50,
        bottom: 850,
        left: 0,
        right: 1000,
        width: 1000,
        height: 800,
      } as DOMRect);
      document.body.appendChild(skillsEl);

      render(
        <ThemeContext.Provider value={{ theme: 'light', toggleTheme: mockToggleTheme }}>
          <Navigation scrollToSection={mockScrollToSection} />
        </ThemeContext.Provider>
      );

      const header = document.querySelector('header');
      expect(header).not.toHaveAttribute('data-contrary');

      document.body.removeChild(aboutEl);
      document.body.removeChild(skillsEl);
    });
  });
});
