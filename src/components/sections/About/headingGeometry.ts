export interface HeadingMetrics {
  viewportWidth: number;
  viewportHeight: number;
  left: number;
  top: number;
  titleWidth: number;
  titleHeight: number;
  subtitleWidth: number;
  subtitleHeight: number;
  subtitleTop: number;
}

/** Center the title and supporting line independently, without changing layout. */
export function centeredHeading(metrics: HeadingMetrics) {
  const { viewportWidth, viewportHeight, left, top, titleWidth, titleHeight,
    subtitleWidth, subtitleHeight, subtitleTop } = metrics;
  const scale = Math.min(1.45, (viewportWidth - 48) / titleWidth);
  const height = titleHeight * scale + 24 + subtitleHeight;
  const originY = (viewportHeight - height) / 2;
  return {
    scale,
    originX: viewportWidth / 2,
    originY,
    titleX: (viewportWidth - titleWidth * scale) / 2 - left,
    titleY: originY - top,
    subtitleX: (viewportWidth - subtitleWidth) / 2 - left,
    subtitleY: originY + titleHeight * scale + 24 - top - subtitleTop,
  };
}
