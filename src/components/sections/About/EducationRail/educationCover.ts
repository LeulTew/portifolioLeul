import { findScrollContainer } from './scrollContainer';

/** Stop painting covered DOM without changing geometry or hiding the native scrollport. */
export function coverEducationBackground(host: HTMLElement, stage: HTMLElement): () => void {
  const main = host.closest('main');
  const container = findScrollContainer(host);
  const parent = main?.parentElement;
  const content = parent && container && parent !== container && container.contains(parent)
    ? parent : main;
  const nodes = new Set(document.querySelectorAll<HTMLElement>('[data-pinned-sequence]'));
  if (content) nodes.add(content);
  const covered = [...nodes].filter(node => !node.contains(stage)).map(node => ({
    node,
    visibility: node.style.getPropertyValue('visibility'),
    priority: node.style.getPropertyPriority('visibility'),
    marker: node.getAttribute('data-education-covered'),
  }));
  for (const { node } of covered) {
    node.setAttribute('data-education-covered', '');
    node.style.visibility = 'hidden';
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const { node, visibility, priority, marker } of covered) {
      if (visibility) node.style.setProperty('visibility', visibility, priority);
      else node.style.removeProperty('visibility');
      if (marker === null) node.removeAttribute('data-education-covered');
      else node.setAttribute('data-education-covered', marker);
    }
  };
}
