/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react';
import { Projects } from './Projects';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';

// Mock framer-motion with NO ref forwarding to simulate null ref
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const React = await vi.importActual('react') as any;
  return {
    ...actual,
    motion: {
      div: React.forwardRef(({ children, className, style, onClick, onMouseEnter, onMouseLeave, ...props }: any, ref: any) => (
        <div
          // No ref here to simulate null ref for carousel
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

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Globe: () => <svg />,
  Smartphone: () => <svg />,
  Brain: () => <svg />,
  Gamepad2: () => <svg />,
  Shapes: () => <svg />,
  Grid3x3: () => <svg />,
}));

describe('Projects Null Ref Coverage', () => {
  it('cleans up resize listener when carousel ref is null', () => {
    const { unmount } = render(<Projects />);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    unmount();
    
    // Should call removeEventListener for resize (line 122)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
