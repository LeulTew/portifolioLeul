import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectsData } from '@/data/projects';
import type { FocusRailItem } from '@/components/ui/focus-rail';
import { FlatProjects } from './FlatProjects';

vi.mock('@/components/ui/focus-rail', () => ({
  FocusRail: ({ items }: { items: FocusRailItem[] }) => <div>
    {items.map(item => <article key={item.id} aria-label={item.title}>{item.description}</article>)}
  </div>,
}));
vi.mock('@/components/ui/StripReveal', () => ({
  StripReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/FocusScrim', () => ({ FocusScrim: () => null }));
vi.mock('@/components/ui/KineticText', () => ({
  KineticHeading: ({ text }: { text: string }) => <h2>{text}</h2>,
}));
vi.mock('@/lib/scroll/viewportCoverage', () => ({ useViewportShareEffect: () => {} }));

afterEach(cleanup);

describe('flat project evidence parity', () => {
  it('retains all descriptions and the same optional inspection notes as the TV', () => {
    render(<FlatProjects />);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(36);
    for (const [index, project] of projectsData.entries()) {
      const article = articles[index];
      expect(article).toHaveAccessibleName(project.title);
      if (project.imageNote) expect(article).toHaveTextContent(project.imageNote);
      for (const line of (project.longDescription || project.description).split('\n').filter(line => line.trim())) {
        expect(article).toHaveTextContent(line.replace(/\*\*/g, ''));
      }
      const visual = within(article).getByRole('link', {
        name: `Open ${project.title} portfolio image at full size (new tab)`,
      });
      expect(visual).toHaveAttribute('href', project.image);
      expect(visual).toHaveAttribute('target', '_blank');
      expect(visual).toHaveAttribute('rel', 'noopener noreferrer');
      if (project.evidence) {
        expect(within(article).getByRole('heading', { name: 'What to inspect' })).toBeVisible();
        expect(article).toHaveTextContent(project.evidence.inspect);
        expect(article).toHaveTextContent(project.evidence.access!);
        if (project.evidence.sourceNote) expect(article).toHaveTextContent(project.evidence.sourceNote);
        if (project.evidence.decision) {
          expect(within(article).getByRole('link', { name: project.evidence.decision.sourceLabel }))
            .toHaveAttribute('href', project.evidence.decision.sourceUrl);
        }
      } else {
        expect(article.querySelector('[data-project-evidence]')).toBeNull();
      }
    }
  });
});
