import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroAperture } from './HeroAperture';
import { SLIT_SHARE } from '@/lib/motion/heroAperture';

const reducedMotion = vi.fn(() => false);
vi.mock('@/lib/gateways/animationGateway', () => ({
  getPrefersReducedMotion: () => reducedMotion(),
}));

const scaleY = (element: Element | null) => {
  const transform = (element as HTMLElement | null)?.style.transform ?? '';
  const match = transform.match(/scaleY\(([-\d.]+)\)/);
  return match ? Number(match[1]) : null;
};

describe('HeroAperture', () => {
  beforeEach(() => {
    reducedMotion.mockReturnValue(false);
  });

  it('starts as a slit, with the world showing between the bands', () => {
    // Closed is a letterbox, not a black screen: there is something there from
    // the first frame, and it grows.
    const { getByTestId } = render(<HeroAperture />);

    expect(scaleY(getByTestId('hero-aperture-top'))).toBeCloseTo(1 - SLIT_SHARE, 4);
    expect(scaleY(getByTestId('hero-aperture-bottom'))).toBeCloseTo(1 - SLIT_SHARE, 4);
  });

  it('moves both bands together', () => {
    const { getByTestId } = render(<HeroAperture />);

    expect(scaleY(getByTestId('hero-aperture-top'))).toBe(
      scaleY(getByTestId('hero-aperture-bottom'))
    );
  });

  it('opens all the way, and stays open', async () => {
    /*
     * The entrance only. The exit belongs to the copy's own plate drawing shut
     * around where the name was; this used to close as well, and two vertical
     * closes on one screen competed with each other.
     */
    const { getByTestId } = render(<HeroAperture />);

    await waitFor(
      () => {
        expect(scaleY(getByTestId('hero-aperture-top'))).toBe(0);
      },
      { timeout: 5000 }
    );

    expect(scaleY(getByTestId('hero-aperture-bottom'))).toBe(0);
  });

  it('renders the seam that lights the two edges apart', () => {
    const { getByTestId } = render(<HeroAperture />);
    expect(getByTestId('hero-aperture-seam')).toBeInTheDocument();
  });

  it('is absent entirely under reduced motion', () => {
    // Decoration, not legibility: it is not present rather than snapping open.
    reducedMotion.mockReturnValue(true);

    const { queryByTestId } = render(<HeroAperture />);
    expect(queryByTestId('hero-aperture')).toBeNull();
  });
});
