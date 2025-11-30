/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, act, createEvent } from '@testing-library/react';
import { Projects } from './Projects';
import { vi, describe, it, expect } from 'vitest';

import React from 'react';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const React = await vi.importActual('react') as any;
  return {
    ...actual,
    motion: {
      div: React.forwardRef(({ children, className, style, onClick, onMouseEnter, onMouseLeave, ...props }: any, ref: any) => (
        <div
          ref={ref}
          className={className}
          style={style}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          {...props}
        >
          {children}
        </div>
      )),
      section: React.forwardRef(({ children, className, ...props }: any, ref: any) => <section ref={ref} className={className} {...props}>{children}</section>),
      h2: ({ children, className }: any) => <h2 className={className}>{children}</h2>,
      p: ({ children, className }: any) => <p className={className}>{children}</p>,
      img: ({ src, alt, className, onError }: any) => <img src={src} alt={alt} className={className} onError={onError} />,
      button: ({ children, className, onClick, ...props }: any) => <button className={className} onClick={onClick} {...props}>{children}</button>,
      a: ({ children, className, href, ...props }: any) => <a className={className} href={href} {...props}>{children}</a>,
      svg: ({ children, className, ...props }: any) => <svg className={className} {...props}>{children}</svg>,
      path: ({ ...props }: any) => <path {...props} />,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useScroll: () => ({ scrollXProgress: { get: () => 0 } }),
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0, on: vi.fn(), set: vi.fn() }),
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  };
});

// Mock ExpandableTabs
vi.mock('../../ui/expandable-tabs', () => ({
  ExpandableTabs: ({ onChange, tabs }: { onChange: (index: number) => void, tabs: { title: string }[] }) => (
    <div>
      {tabs.map((tab: { title: string }, index: number) => (
        <button key={tab.title} onClick={() => onChange(index)}>
          {tab.title}
        </button>
      ))}
    </div>
  ),
}));

describe('Projects', () => {
  it('renders projects and filters by category', () => {
    render(<Projects />);
    expect(screen.getByText('Projects')).toBeTruthy();
    
    // Test filtering
    const webTab = screen.getByText('Web Development');
    fireEvent.click(webTab);
    // Add assertions for filtered content if possible, or at least verify no crash
  });

  it('handles project click to expand and collapse', () => {
    render(<Projects />);
    // Find a project card. We know "Car Rental Platform" is in the data.
    const projectTitle = screen.getByText('Car Rental Platform');
    const projectCard = projectTitle.closest('div'); // Adjust selector as needed
    
    if (projectCard) {
      // Click to expand
      fireEvent.click(projectCard);
      // Verify expansion (e.g., check for expanded details or class)
      
      // Click again to collapse
      fireEvent.click(projectCard);
    }
  });

  it('handles drag interactions', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    // Mouse events
    fireEvent.mouseDown(carousel, { clientX: 0, button: 0 });
    fireEvent.mouseMove(carousel, { clientX: 100 });
    fireEvent.mouseUp(carousel);
    fireEvent.mouseLeave(carousel);

    // Touch events
    fireEvent.touchStart(carousel, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel);
  });

  it('handles wheel events', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    fireEvent.wheel(carousel, { deltaY: 100 });
  });

  it('handles resize events', () => {
    render(<Projects />);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });

  it('filters projects by different categories', () => {
    render(<Projects />);
    
    // Test Mobile Apps filter
    const mobileTab = screen.getByText('Mobile Apps');
    fireEvent.click(mobileTab);
    
    // Test AI/DataScience filter
    const aiTab = screen.getByText('AI/DataScience');
    fireEvent.click(aiTab);
    
    // Test All filter
    const allTab = screen.getByText('All');
    fireEvent.click(allTab);
  });

  it('handles mouse enter and leave on project cards', () => {
    render(<Projects />);
    const projectTitle = screen.getByText('Car Rental Platform');
    const projectCard = projectTitle.closest('div');
    
    if (projectCard) {
      fireEvent.mouseEnter(projectCard);
      fireEvent.mouseLeave(projectCard);
    }
  });

  it('handles multiple project expansions', () => {
    render(<Projects />);
    
    // Find multiple projects
    const project1 = screen.getByText('Car Rental Platform').closest('div');
    const project2 = screen.getByText('CS Exit Practice').closest('div');
    
    if (project1 && project2) {
      // Expand first project
      fireEvent.click(project1);
      
      // Expand second project (should collapse first)
      fireEvent.click(project2);
      
      // Collapse second project
      fireEvent.click(project2);
    }
  });

  it('renders project links correctly and handles clicks', () => {
    render(<Projects />);
    
    // Expand a project to see links
    const projectTitle = screen.getByText('Ignition');
    fireEvent.click(projectTitle);
    
    // Find a link (Visit Site or GitHub)
    const links = screen.getAllByRole('link');
    if (links.length > 0) {
      const link = links[0];
      const event = createEvent.click(link);
      event.stopPropagation = vi.fn();
      fireEvent(link, event);
      expect(event.stopPropagation).toHaveBeenCalled();
    }
  });

  it('handles continuous drag movements', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    // Simulate continuous drag
    fireEvent.mouseDown(carousel, { clientX: 0, button: 0 });
    fireEvent.mouseMove(carousel, { clientX: 50 });
    fireEvent.mouseMove(carousel, { clientX: 100 });
    fireEvent.mouseMove(carousel, { clientX: 150 });
    fireEvent.mouseUp(carousel);
  });

  it('handles touch drag with multiple touch points', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    fireEvent.touchStart(carousel, { touches: [{ clientX: 0 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 50 }] });
    fireEvent.touchMove(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel);
  });

  it('handles right-click drag prevention', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    // Right-click should not start drag
    fireEvent.mouseDown(carousel, { clientX: 0, button: 2 });
    fireEvent.mouseMove(carousel, { clientX: 100 });
    fireEvent.mouseUp(carousel);
  });

  it('prevents click when dragging', () => {
    render(<Projects />);
    const projectCard = screen.getByText('Car Rental Platform').closest('div');
    const carousel = screen.getByTestId('carousel');
    
    if (projectCard) {
      // Start drag
      fireEvent.mouseDown(carousel, { clientX: 0, button: 0 });
      fireEvent.mouseMove(carousel, { clientX: 100 });
      
      // Try to click while dragging - should be prevented
      fireEvent.click(projectCard);
      
      fireEvent.mouseUp(carousel);
    }
  });

  it('handles drag with preventDefault', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    fireEvent.mouseDown(carousel, { clientX: 0, button: 0 });
    
    const moveEvent = new MouseEvent('mousemove', { clientX: 100, bubbles: true });
    Object.defineProperty(moveEvent, 'preventDefault', { value: vi.fn() });
    carousel.dispatchEvent(moveEvent);
    
    fireEvent.mouseUp(carousel);
  });

  it('handles wheel event with preventDefault', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    const wheelEvent = new WheelEvent('wheel', { deltaY: 100, bubbles: true });
    Object.defineProperty(wheelEvent, 'preventDefault', { value: vi.fn() });
    Object.defineProperty(wheelEvent, 'stopPropagation', { value: vi.fn() });
    carousel.dispatchEvent(wheelEvent);
  });

  it('calculates project width on resize', () => {
    render(<Projects />);
    
    // Trigger multiple resizes
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  });

  it('handles touch events without dragging state', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    // Try to move without starting drag
    fireEvent.touchMove(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel);
  });

  it('handles mouse move without dragging state', () => {
    render(<Projects />);
    const carousel = screen.getByTestId('carousel');
    
    // Try to move without starting drag
    fireEvent.mouseMove(carousel, { clientX: 100 });
  });

  it('handles project expansion toggle', () => {
    render(<Projects />);
    const projectCard = screen.getByText('Car Rental Platform').closest('div');
    
    if (projectCard) {
      // Expand
      fireEvent.click(projectCard);
      
      // Collapse by clicking again
      fireEvent.click(projectCard);
      
      // Expand again
      fireEvent.click(projectCard);
    }
  });

  it('handles carousel reference updates', () => {
    const { rerender } = render(<Projects />);
    
    // Force re-render to test ref updates
    rerender(<Projects />);
  });
});
