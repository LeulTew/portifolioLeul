// @vitest-environment happy-dom
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
  it('jumps straight to any current-category project and keeps native picker input isolated', () => {
    render(<TVProjects />);
    const picker = screen.getByRole('combobox', { name: 'Choose a project' });
    expect(within(picker).getAllByRole('option')).toHaveLength(projectsData.length);
    const selected = projectsData[projectsData.length - 1];
    picker.focus();
    fireEvent.change(picker, { target: { value: String(selected.id) } });
    expect(screen.getByRole('heading', { name: selected.title, level: 3 })).toBeVisible();
    expect(picker).toHaveFocus();
    const wheel = new WheelEvent('wheel', { deltaY: 900, bubbles: true, cancelable: true });
    fireEvent(picker, wheel);
    const retargeted = new WheelEvent('wheel', { deltaY: 900, bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('tabpanel'), retargeted);
    expect(retargeted.defaultPrevented).toBe(false);
    fireEvent.keyDown(picker, { key: 'ArrowLeft' });
    expect(wheel.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', String(selected.id));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.keyDown(picker, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: String(projectsData[0].id) } });
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Web Development' }));
    const web = projectsData.filter(project => project.categories.includes('Web Development'));
    expect(within(picker).getAllByRole('option').map(option => option.textContent)).toEqual(web.map(project => project.title));
    fireEvent.change(picker, { target: { value: String(web.at(-1)!.id) } });
    fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    expect(screen.getByRole('heading', { name: web[0].title, level: 3 })).toBeInTheDocument();
  });

  it('is readable without a ready TV and exposes a real navigation anchor', () => {
    render(<TVProjects />);
    expect(document.querySelector('#projects')).toHaveAttribute('data-staged', 'false');
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeVisible();
    expect(screen.getByRole('heading', { name: projectsData[0].title })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next project' })).toBeEnabled();
    expect(document.querySelector('[data-projects-header]')?.tagName).toBe('DIV');
    expect(document.querySelector('[data-projects-footer]')?.tagName).toBe('DIV');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it.each(PROJECT_CATEGORIES)('retains every real %s project and original link, including looping', category => {
    render(<TVProjects />);
    fireEvent.click(screen.getByRole('tab', { name: category }));
    const items = category === 'All' ? projectsData : projectsData.filter(project => project.categories.includes(category));
    const next = screen.getByRole('button', { name: 'Next project' });
    const previous = screen.getByRole('button', { name: 'Previous project' });
    for (const project of items) {
      expect(screen.getByRole('heading', { name: project.title, level: 3 })).toBeVisible();
      expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', String(project.id));
      const links = screen.getAllByRole('link');
      expect(links.map(link => link.getAttribute('href')))
        .toEqual([project.demoUrl, project.githubUrl, project.image].filter(Boolean));
      const visual = screen.getByRole('link', {
        name: `Open ${project.title} portfolio image at full size (new tab)`,
      });
      expect(visual.closest('[data-projects-footer]')).not.toBeNull();
      expect(visual.closest('[data-projects-scrollable]')).toBeNull();
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
      fireEvent.click(next);
    }
    expect(screen.getByRole('heading', { name: items[0].title, level: 3 })).toBeVisible();
    fireEvent.click(previous);
    expect(screen.getByRole('heading', { name: items[items.length - 1].title, level: 3 })).toBeVisible();
  });

  it('shows complete factual descriptions and technology in its own scrollable details view', () => {
    render(<TVProjects />);
    const toggle = screen.getByRole('button', { name: 'Details' });
    const next = screen.getByRole('button', { name: 'Next project' });
    for (const project of projectsData) {
      fireEvent.click(toggle);
      const details = screen.getByLabelText(`${project.title} details`);
      expect(details).toHaveAttribute('data-projects-scrollable');
      for (const line of (project.longDescription || project.description).split('\n').filter(line => line.trim())) {
        expect(details).toHaveTextContent(line.replace(/\*\*/g, ''));
      }
      expect(details).toHaveTextContent(project.tech);
      expect(toggle).toHaveAccessibleName('Preview');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(next);
      expect(toggle).toHaveAccessibleName('Details');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('keeps inspection guidance and source proof in Details rather than the preview', () => {
    render(<TVProjects />);
    const toggle = screen.getByRole('button', { name: 'Details' });
    const next = screen.getByRole('button', { name: 'Next project' });
    for (const project of projectsData) {
      expect(screen.queryByRole('heading', { name: 'What to inspect' })).not.toBeInTheDocument();
      if (project.evidence?.access) {
        expect(screen.getByLabelText(`${project.title} summary`))
          .toHaveTextContent(project.evidence.access);
      }
      fireEvent.click(toggle);
      const details = screen.getByLabelText(`${project.title} details`);
      if (project.evidence) {
        expect(within(details).getByRole('heading', { name: 'What to inspect', level: 4 })).toBeVisible();
        expect(details).toHaveTextContent(project.evidence.inspect);
        expect(details).toHaveTextContent(project.evidence.access!);
        if (project.evidence.sourceNote) expect(details).toHaveTextContent(project.evidence.sourceNote);
      } else {
        expect(details.querySelector('[data-project-evidence]')).toBeNull();
      }
      if (project.evidence?.decision) {
        const decision = project.evidence.decision;
        expect(details).toHaveTextContent(decision.summary);
        const source = within(details).getByRole('link', { name: decision.sourceLabel });
        expect(source).toHaveAttribute('href', decision.sourceUrl);
        expect(source).toHaveAttribute('target', '_blank');
        expect(source).toHaveAttribute('rel', 'noopener noreferrer');
        fireEvent.keyDown(source, { key: 'ArrowRight' });
        expect(document.querySelector('[data-project-id]'))
          .toHaveAttribute('data-project-id', String(project.id));
      } else {
        expect(within(details).queryByRole('heading', { name: 'Implementation' })).not.toBeInTheDocument();
      }
      fireEvent.click(next);
    }
  });

  it('keeps the native image action in the fixed preview footer and retains the Details alternative', () => {
    render(<TVProjects />);
    const project = projectsData[0];
    const label = `Open ${project.title} portfolio image at full size (new tab)`;
    const imageLink = screen.getByRole('link', { name: label });
    expect(imageLink).toHaveAttribute('href', project.image);
    expect(imageLink).toHaveTextContent('Full image');
    expect(imageLink.closest('[data-projects-footer]')).not.toBeNull();
    expect(imageLink.closest('[data-projects-scrollable]')).toBeNull();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(imageLink, click);
    expect(click.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', String(project.id));
    const toggle = screen.getByRole('button', { name: 'Details' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Preview' })).toBe(toggle);
    const details = screen.getByLabelText(`${project.title} details`);
    const detailsImage = within(details).getByRole('link', { name: label });
    expect(detailsImage).toHaveAttribute('href', project.image);
    expect(detailsImage).toHaveTextContent('Full-size portfolio image');
    expect(detailsImage.closest('[data-projects-footer]')).toBeNull();
    expect(screen.getAllByRole('link', { name: label })).toHaveLength(1);
    const wheel = new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true });
    fireEvent(details, wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(document.querySelector('[data-project-id]')).toHaveAttribute('data-project-id', String(project.id));
    fireEvent.keyDown(details, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Details' })).toBe(toggle);
    expect(toggle).toHaveFocus();
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
