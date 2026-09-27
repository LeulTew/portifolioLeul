import { findScrollContainer } from '@/lib/scroll/scrollContainer';

/**
 * Stop painting covered DOM without changing geometry or hiding the native scrollport.
 *
 * `container` is the scrollport, if the caller has already read it: finding it reads computed
 * style, and read after a claim's writes that forced a style pass over the whole chapter.
 */
export function coverChapterBackground(
  host: HTMLElement,
  stage: HTMLElement,
  owner: 'education' | 'skills' | 'projects' = 'education',
  container: HTMLElement | null = findScrollContainer(host),
): () => void {
  const attribute = `data-${owner}-covered`;
  const main = host.closest('main');
  const parent = main?.parentElement;
  const content = parent && container && parent !== container && container.contains(parent)
    ? parent : main;
  const nodes = new Set(document.querySelectorAll<HTMLElement>('[data-pinned-sequence]'));
  if (content) nodes.add(content);
  const covered = [...nodes].filter(node => !node.contains(stage)).map(node => ({
    node,
    visibility: node.style.getPropertyValue('visibility'),
    priority: node.style.getPropertyPriority('visibility'),
    marker: node.getAttribute(attribute),
  }));
  for (const { node } of covered) {
    node.setAttribute(attribute, '');
    node.style.visibility = 'hidden';
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const { node, visibility, priority, marker } of covered) {
      if (visibility) node.style.setProperty('visibility', visibility, priority);
      else node.style.removeProperty('visibility');
      if (marker === null) node.removeAttribute(attribute);
      else node.setAttribute(attribute, marker);
    }
  };
}

export { coverChapterBackground as coverEducationBackground };
