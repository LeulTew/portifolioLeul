export interface HeroContentBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Untransformed layout bounds stay stable while individual exit layers move. */
export function measureHeroContent(content: HTMLElement): HeroContentBounds | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const layers = content.querySelectorAll<HTMLElement>('[data-cue-layer]:not([data-cue-layer="backdrop"])');
  const targets = Array.from(layers).flatMap(layer => layer.dataset.cueLayer === 'actions'
    ? Array.from(layer.querySelectorAll<HTMLElement>('button, a'))
    : [layer]);
  for (const layer of targets) {
    if (!layer.offsetWidth || !layer.offsetHeight) continue;
    let x = layer.offsetLeft;
    let y = layer.offsetTop;
    let parent = layer.offsetParent;
    while (parent instanceof HTMLElement && parent !== content) {
      x += parent.offsetLeft;
      y += parent.offsetTop;
      parent = parent.offsetParent;
    }
    if (parent !== content) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + layer.offsetWidth);
    bottom = Math.max(bottom, y + layer.offsetHeight);
  }
  return Number.isFinite(left) ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
}

export function cloudBounds(content: HeroContentBounds) {
  const horizontalFeather = Math.max(80, content.width * 0.52);
  const verticalFeather = Math.max(64, content.height * 0.45);
  return {
    left: content.left - horizontalFeather,
    top: content.top - verticalFeather,
    width: content.width + horizontalFeather * 2,
    height: content.height + verticalFeather * 2,
  };
}
