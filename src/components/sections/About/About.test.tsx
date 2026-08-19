import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { About } from './About';

// Mock framer-motion useScroll & useSpring
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useScroll: () => ({
      scrollYProgress: { get: () => 0.5 },
    }),
    useSpring: (val: unknown) => val,
    useTransform: () => 0,
  };
});

describe('About Section', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders about me header, bio content and tags', () => {
    render(<About />);
    expect(screen.getByText('About Me')).toBeDefined();
    expect(screen.getByText(/Software Engineer & Creative Developer/i)).toBeDefined();
  });

  it('renders education cards in the right-aligned layout', () => {
    render(<About />);
    expect(screen.getByText('Education')).toBeDefined();
    expect(screen.getByText(/HiLCoE School of Computer Science/i)).toBeDefined();
    expect(screen.getByText(/Saint Joseph School/i)).toBeDefined();
  });

  it('renders certifications cards cleanly', () => {
    render(<About />);
    expect(screen.getByText('Certifications')).toBeDefined();
    expect(screen.getByText(/Bootdev/i)).toBeDefined();
  });
});
