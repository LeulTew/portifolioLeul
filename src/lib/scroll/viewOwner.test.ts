import { afterEach, describe, expect, it } from 'vitest';
import { claimView, viewOwner } from './viewOwner';

const releases: (() => void)[] = [];
const claim = (...args: Parameters<typeof claimView>) => {
  const release = claimView(...args);
  releases.push(release);
  return release;
};
afterEach(() => {
  for (const release of releases.splice(0)) release();
});

describe('the view owner', () => {
  it('keeps the story inert through a handoff until the last owner releases it', () => {
    // Round 9 (TECH-006): Skills leaving reopened the story under the TV that had found it inert.
    const story = document.createElement('main');
    const skills = claim('skills', story);
    expect(story).toHaveAttribute('inert');
    expect(viewOwner()).toBe('skills');
    const tv = claim('projects', story);
    expect(viewOwner()).toBe('projects');
    skills();
    expect(story).toHaveAttribute('inert');
    expect(viewOwner()).toBe('projects');
    tv();
    expect(story).not.toHaveAttribute('inert');
    expect(viewOwner()).toBeNull();
  });

  it('lets an owner that mounts under another take its own claim', () => {
    // Round 9 (TECH-027): Skills remounted while the TV held the story never took the flag.
    const story = document.createElement('main');
    const tv = claim('projects', story);
    const skills = claim('skills', story);
    tv();
    expect(story).toHaveAttribute('inert');
    expect(viewOwner()).toBe('skills');
    skills();
    expect(story).not.toHaveAttribute('inert');
  });

  it('releases once, and never removes an inert flag it did not set', () => {
    const story = document.createElement('main');
    story.setAttribute('inert', '');
    const skills = claim('skills', story);
    skills();
    skills();
    expect(story).toHaveAttribute('inert');
    expect(viewOwner()).toBeNull();

    const open = document.createElement('main');
    const tv = claim('projects', open);
    const other = claim('skills', open);
    tv();
    tv();
    expect(open).toHaveAttribute('inert');
    other();
    expect(open).not.toHaveAttribute('inert');
  });

  it('names the owner even when there is no story to hold', () => {
    const skills = claim('skills', null);
    expect(viewOwner()).toBe('skills');
    skills();
    expect(viewOwner()).toBeNull();
  });
});
