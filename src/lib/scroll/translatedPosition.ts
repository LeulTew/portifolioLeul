const translation = /^translate3d\([^,]+,\s*([-+\d.eE]+)px,\s*0(?:px)?\)$/;
const matrix = /^matrix\(1,\s*0,\s*0,\s*1,\s*[-+\d.eE]+,\s*([-+\d.eE]+)\)$/;

/** Read the scrolling layer's CSS translation without forcing style/layout. */
export function translatedY(transform: string): number | null {
  const match = translation.exec(transform) ?? matrix.exec(transform);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** The nearest ancestor carrying an inline transform: drei's scrolling html layer. */
export function translatedLayerOf(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement; node && node !== document.body; node = node.parentElement) {
    if (node.style.transform && node.style.transform !== 'none') return node;
  }
  return null;
}

export function createTranslatedPositionReader(element: HTMLElement, getLayer: () => HTMLElement | null) {
  let layer: HTMLElement | null = null;
  let layoutTop: number | null = null;
  let height = 0;
  let transform = '';
  let y: number | null = null;

  const readTranslation = (current: HTMLElement | null) => {
    if (current !== layer) {
      layer = current;
      layoutTop = null;
      transform = '';
      y = null;
    }
    const value = current?.style.transform ?? '';
    if (value !== transform) {
      transform = value;
      y = translatedY(value);
    }
    return y;
  };

  const refresh = () => {
    const offset = readTranslation(getLayer());
    const rect = element.getBoundingClientRect();
    layoutTop = offset === null ? null : rect.top - offset;
    height = rect.height;
    return rect.top;
  };

  const read = () => {
    const offset = readTranslation(getLayer());
    // Other transforms and the ordinary document-scroll fallback still use
    // real geometry; never infer a translation from a scale or perspective.
    if (offset === null || layoutTop === null) return refresh();
    return layoutTop + offset;
  };

  return {
    refresh,
    read,
    /** Top as `read`, with the height measured at the last layout refresh. */
    readRect: () => {
      const top = read();
      return { top, height };
    },
  };
}
