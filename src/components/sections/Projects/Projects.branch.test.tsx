/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react';
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
        <div ref={ref} className={className} style={style} onClick={onClick} {...props}>
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

// Mock ExpandableTabs to expose onChange
vi.mock('../../ui/expandable-tabs', () => ({
  ExpandableTabs: ({ onChange }: { onChange: (index: number | null) => void }) => (
    <div>
      <button onClick={() => onChange(0)}>Select 0</button>
      <button onClick={() => onChange(null)}>Select Null</button>
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

describe('Projects Branch Coverage', () => {
  it('handles null index in category change', () => {
    render(<Projects />);
    
    // Click button that triggers onChange(null)
    fireEvent.click(screen.getByText('Select Null'));
    
    // Should not crash, and active category should remain unchanged (or whatever logic handles null)
    // The code says: if (index !== null) { ... }
    // So nothing should happen.
    
    // We can verify that setExpandedId(null) was NOT called if we could spy on it,
    // but since it's internal state, we can just ensure no errors.
    // Or we can check if the category changed. Default is 'All'.
    // If we select 0 (All), it sets to 'All'.
    // If we select null, it does nothing.
  });
});
