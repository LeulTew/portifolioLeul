import { expect, it, vi } from 'vitest';
import { publishSectionNavigation, subscribeSectionNavigation } from './sectionNavigation';

it('publishes explicit destinations only to currently mounted readers', () => {
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = subscribeSectionNavigation(first);
  const removeSecond = subscribeSectionNavigation(second);
  publishSectionNavigation('about');
  expect(first).toHaveBeenCalledExactlyOnceWith('about');
  expect(second).toHaveBeenCalledExactlyOnceWith('about');
  removeFirst();
  publishSectionNavigation('contact');
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenLastCalledWith('contact');
  removeSecond();
  publishSectionNavigation('home');
  expect(second).toHaveBeenCalledTimes(2);
});
