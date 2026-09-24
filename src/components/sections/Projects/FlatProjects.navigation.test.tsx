import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { FlatProjects } from './FlatProjects';

vi.mock('@/components/ui/focus-rail', () => ({ FocusRail: () => null }));
vi.mock('@/components/ui/StripReveal', () => ({
  StripReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/FocusScrim', () => ({ FocusScrim: () => null }));
vi.mock('@/components/ui/KineticText', () => ({
  KineticHeading: ({ text }: { text: string }) => <h2>{text}</h2>,
}));
vi.mock('@/lib/scroll/viewportCoverage', () => ({ useViewportShareEffect: () => {} }));

afterEach(cleanup);

const reader = () => screen.getByRole('heading', { name: 'Featured Projects' }).closest('header')!.parentElement!;

describe('flat projects arrival', () => {
  it('lands navbar and keyboard arrivals settled rather than mid-fade', () => {
    // Round 7 (D-FLAT-001): Tab reached the category tabs at 36% opacity.
    render(<FlatProjects />);
    expect(Number(reader().style.opacity)).toBe(0.35);

    act(() => publishSectionNavigation('skills', { source: 'navbar' }));
    act(() => publishSectionNavigation('projects'));
    expect(Number(reader().style.opacity)).toBe(0.35);

    act(() => publishSectionNavigation('projects', { source: 'navbar' }));
    expect(Number(reader().style.opacity)).toBe(1);
    expect(reader().style.transform).toMatch(/^scale\(1(\.0+)?\)$/);
  });
});
