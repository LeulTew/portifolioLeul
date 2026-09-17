import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVProjects } from './TVProjects';
import { PROJECT_CATEGORIES } from './projectCategories';
import { projectsData } from '@/data/projects';
import { setProjectsView, setTVScreenReady } from '@/lib/projects/projectsScene';

// Animation clocks and retargeting are exercised in projectBroadcast and playback tests.
vi.mock('./projectBroadcast', () => ({
  useProjectBroadcast: () => {},
  useCRTPowerOn: () => {},
}));

beforeEach(() => {
  setProjectsView(false, 0, 0);
  setTVScreenReady(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the semantic TV project reader', () => {
  it('is readable without a ready TV and exposes a real navigation anchor', () => {
    render(<TVProjects />);
    expect(document.querySelector('#projects')).toHaveAttribute('data-staged', 'false');
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeVisible();
    expect(screen.getByRole('heading', { name: projectsData[0].title })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next project' })).toBeEnabled();
  });

  it.each(PROJECT_CATEGORIES)('retains every real %s project and original link, including looping', category => {
    render(<TVProjects />);
    fireEvent.click(screen.getByRole('tab', { name: category }));
    const items = category === 'All' ? projectsData : projectsData.filter(project => project.categories.includes(category));
    for (const project of items) {
      expect(screen.getByRole('heading', { name: project.title, level: 3 })).toBeVisible();
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', String(project.id));
      const links = screen.getAllByRole('link');
      expect(links.map(link => link.getAttribute('href')))
        .toEqual([project.demoUrl, project.githubUrl].filter(Boolean));
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
      fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    }
    expect(screen.getByRole('heading', { name: items[0].title, level: 3 })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous project' }));
    expect(screen.getByRole('heading', { name: items[items.length - 1].title, level: 3 })).toBeVisible();
  });

  it('shows complete factual descriptions and technology in its own scrollable details view', () => {
    render(<TVProjects />);
    for (const project of projectsData) {
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
      const details = screen.getByLabelText(`${project.title} details`);
      expect(details).toHaveAttribute('data-projects-scrollable');
      for (const line of (project.longDescription || project.description).split('\n').filter(line => line.trim())) {
        expect(details).toHaveTextContent(line.replace(/\*\*/g, ''));
      }
      expect(details).toHaveTextContent(project.tech);
      expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
      expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('uses roving semantic category tabs and keeps keyboard focus with the selection', () => {
    render(<TVProjects />);
    const all = screen.getByRole('tab', { name: 'All' });
    all.focus();
    expect(all).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    const web = screen.getByRole('tab', { name: 'Web Development' });
    expect(web).toHaveFocus();
    expect(web).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', web.id);
    fireEvent.keyDown(web, { key: 'ArrowLeft' });
    fireEvent.keyDown(all, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Desktop & Games' })).toHaveFocus();
  });

  it('supports reader arrow keys and Escape without cancelling keyboard input', () => {
    render(<TVProjects />);
    const panel = screen.getByRole('tabpanel');
    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    fireEvent(panel, right);
    expect(right.defaultPrevented).toBe(false);
    expect(screen.getByRole('heading', { name: projectsData[1].title, level: 3 })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.keyDown(screen.getByLabelText(`${projectsData[1].title} details`), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
  });

  it('reports a failed image while keeping its full details and links usable', () => {
    render(<TVProjects />);
    fireEvent.error(screen.getByRole('img', { name: `${projectsData[0].title} preview` }));
    expect(screen.getByText(/Preview unavailable/)).toBeVisible();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', projectsData[0].demoUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByLabelText(`${projectsData[0].title} details`)).toHaveTextContent(projectsData[0].tech);
    fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    expect(screen.getByRole('img', { name: `${projectsData[1].title} preview` })).toBeVisible();
  });

  it('has no autoplay and keeps expanded Details isolated from vertical page browsing', () => {
    vi.useFakeTimers();
    try {
      render(<TVProjects />);
      const original = document.querySelector('[data-project-id]')?.getAttribute('data-project-id');
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));
      const details = screen.getByLabelText(`${projectsData[0].title} details`);
      const event = new WheelEvent('wheel', { deltaY: 900, bubbles: true, cancelable: true });
      fireEvent(details, event);
      act(() => vi.advanceTimersByTime(30000));
      expect(event.defaultPrevented).toBe(false);
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', original);
      expect(within(details).getByRole('heading', { name: projectsData[0].title })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});
