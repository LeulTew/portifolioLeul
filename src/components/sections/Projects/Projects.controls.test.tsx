import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TVProjects } from './TVProjects';
import { projectsData } from '@/data/projects';
import { setTVScreenReady } from '@/lib/projects/projectsScene';

vi.mock('./projectBroadcast', () => ({
  useCRTPowerOn: () => {},
  useProjectBroadcast: () => {},
}));

beforeEach(() => setTVScreenReady(false));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const current = () => Number(document.querySelector('[data-project-id]')?.getAttribute('data-project-id'));

describe('responsive project content selection', () => {
  it('loops within the chosen category and never uses page browsing to leave the TV', () => {
    const navigate = vi.fn();
    render(<TVProjects onNavigate={navigate} />);
    const display = screen.getByRole('tabpanel');
    fireEvent.wheel(display, { deltaY: -100 });
    expect(current()).toBe(projectsData[projectsData.length - 1].id);
    fireEvent.wheel(display, { deltaY: 100 });
    expect(current()).toBe(projectsData[0].id);
    fireEvent.click(screen.getByRole('tab', { name: 'Mobile Apps' }));
    const mobile = projectsData.filter(project => project.categories.includes('Mobile Apps'));
    fireEvent.click(screen.getByRole('button', { name: 'Previous project' }));
    expect(current()).toBe(mobile[mobile.length - 1].id);
    fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    expect(current()).toBe(mobile[0].id);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses the latest category even when a category click and next action share one batch', () => {
    render(<TVProjects />);
    const mobile = projectsData.filter(project => project.categories.includes('Mobile Apps'));
    act(() => {
      screen.getByRole('tab', { name: 'Mobile Apps' }).click();
      screen.getByRole('button', { name: 'Next project' }).click();
      screen.getByRole('button', { name: 'Next project' }).click();
    });
    expect(current()).toBe(mobile[2].id);
  });

  it('isolates the whole expanded-details screen while keeping its explicit controls immediate', () => {
    render(<TVProjects />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    const display = screen.getByRole('tabpanel');
    const initial = current();
    for (const target of [
      display,
      display.querySelector('[data-projects-header]')!,
      display.querySelector('[data-projects-footer]')!,
    ]) {
      const event = new WheelEvent('wheel', { deltaY: 800, bubbles: true, cancelable: true });
      fireEvent(target, event);
      expect(event.defaultPrevented).toBe(false);
      expect(current()).toBe(initial);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Next project' }));
    expect(current()).toBe(projectsData[1].id);
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.wheel(display, { deltaY: 100 });
    expect(current()).toBe(projectsData[2].id);
  });
});
