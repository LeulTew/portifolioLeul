/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ThemeProvider } from './components/sections/theme/ThemeProvider';

/*
 * The spatial stage's module requested, and never answered: a stalled chunk
 * request, not a failed one. A rejection reaches the error boundary and the
 * flat page; a request that stays open reached nothing, and once the loader's
 * failsafe lifted it the page was the navbar alone (round 12, TECH-035).
 */
vi.mock('./components/3d/spatialStageModule', () => ({
  loadSpatialStage: () => new Promise(() => {}),
}));
vi.mock('./lib/render/webglSupport', () => ({ isWebGLAvailable: () => true, resetWebGLSupport: () => {} }));
vi.mock('./lib/gateways/gpuTier', () => {
  const config = { tier: 'high', softwareRenderer: false, particleCount: 2000, dpr: 1.5 };
  return { useGpuTier: () => config, getGpuTier: () => config };
});
vi.mock('./components/Loader', () => ({ Loader: () => <div role="progressbar" /> }));
vi.mock('./components/sections/Home/Home', () => ({ Home: () => <section id="home">Home Section</section> }));
vi.mock('./components/sections/About/About', () => ({ About: () => <section id="about">About Section</section> }));
vi.mock('./components/sections/Skills/Skills', () => ({ Skills: () => <section id="skills">Skills Section</section> }));
vi.mock('./components/sections/Projects/Projects', () => ({ Projects: () => <section id="projects">Projects Section</section> }));
vi.mock('./components/sections/Contact/Contact', () => ({ Contact: () => <section id="contact">Contact Section</section> }));
vi.mock('./components/avatar/AvatarEncounter', () => ({ AvatarEncounter: () => null }));
vi.mock('./components/tv/TVControls', () => ({ TVControls: () => null }));

class Observer {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', Observer as any);
  vi.stubGlobal('ResizeObserver', Observer as any);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a spatial stage that never arrives', () => {
  it('gives the reader the flat page when the loader failsafe lifts, not the navbar alone', async () => {
    render(<ThemeProvider><App /></ThemeProvider>);
    await act(async () => {});
    expect(screen.queryByText('Contact Section')).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(45_000); });
    expect(screen.getByText('Home Section')).toBeInTheDocument();
    expect(screen.getByText('Contact Section')).toBeInTheDocument();
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/did not load in time/));
  });
});
