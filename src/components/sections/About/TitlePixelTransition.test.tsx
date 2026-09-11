import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePixelTransition } from './TitlePixelTransition';

describe('TitlePixelTransition Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial heading "About Me" and subtitle', () => {
    render(<TitlePixelTransition />);
    const heading = screen.getByRole('heading', { level: 2, name: /About Me/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByTestId('title-pixel-transition-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('title-pixel-transition-dot').length).toBeGreaterThan(0);
  });

  it('contains expected number of pixel dots for title text box', () => {
    render(<TitlePixelTransition />);
    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    expect(dots.length).toBe(12 * 3); // 12 cols * 3 rows (chunky square tiles)
  });

  it('progressively writes and reveals "Education" when progress advances', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');

    // Simulate progress at end of typing (e.g. 0.94)
    container.style.setProperty('--seq', '0.94');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toBe('Education');
  });

  it('respects custom initial and flipped text props', () => {
    render(
      <TitlePixelTransition
        initialTitle="Custom Start"
        flippedTitle="Custom End"
      />
    );
    expect(screen.getByText('Custom Start')).toBeInTheDocument();
  });

  it('Phase 1: white pixel dots activate and cover/dissolve About Me', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 0.88 is p ~ 0.25 (Phase 1)
    container.style.setProperty('--seq', '0.88');
    window.dispatchEvent(new Event('resize'));

    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    const activeDots = dots.filter((d) => d.getAttribute('data-active') === 'true');
    expect(activeDots.length).toBeGreaterThan(0);
  });

  it('Phase 2: Education begins emerging within active pixel field', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 0.91 is p ~ 0.625 (Phase 2 writing phase)
    container.style.setProperty('--seq', '0.91');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toMatch(/^Edu/);
  });

  it('Phase 3: pixel dots clear away leaving clean Education title', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');

    // seq = 0.94 (Phase 3 complete)
    container.style.setProperty('--seq', '0.94');
    window.dispatchEvent(new Event('resize'));

    const heading = screen.getByTestId('title-pixel-transition-heading');
    expect(heading.textContent).toBe('Education');

    const dots = screen.getAllByTestId('title-pixel-transition-dot');
    const activeDots = dots.filter((d) => d.getAttribute('data-active') === 'true');
    expect(activeDots.length).toBe(0);
  });

  it('renders correctly with explicit progress override', () => {
    const { rerender } = render(<TitlePixelTransition progress={0} />);
    expect(screen.getByTestId('title-pixel-transition-heading').textContent).toBe('About Me');

    rerender(<TitlePixelTransition progress={0.65} />);
    expect(screen.getByTestId('title-pixel-transition-heading').textContent).toMatch(/^Edu/);

    rerender(<TitlePixelTransition progress={1.0} />);
    expect(screen.getByTestId('title-pixel-transition-heading').textContent).toBe('Education');
  });

  it('boundary clamp at seq >= 0.98 guarantees full Education heading before unpin', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');
    container.style.setProperty('--seq', '0.99');
    window.dispatchEvent(new Event('resize'));

    expect(screen.getByTestId('title-pixel-transition-heading').textContent).toBe('Education');
  });

  it('boundary clamp at seq <= 0.05 guarantees pristine About Me heading', () => {
    render(<TitlePixelTransition start={0.86} end={0.94} />);
    const container = screen.getByTestId('title-pixel-transition');
    container.style.setProperty('--seq', '0.02');
    window.dispatchEvent(new Event('resize'));

    expect(screen.getByTestId('title-pixel-transition-heading').textContent).toBe('About Me');
  });

  it('holds the heading its normal colour until the green has actually arrived', () => {
    document.documentElement.dataset.theme = 'light';
    const aboutSection = document.createElement('div');
    aboutSection.id = 'about';
    document.body.appendChild(aboutSection);

    try {
      render(<TitlePixelTransition start={0.86} end={0.94} />);
      const container = screen.getByTestId('title-pixel-transition');
      const heading = screen.getByTestId('title-pixel-transition-heading');

      // Before green background (seq = 0.50): heading should be dark (#111827)
      container.style.setProperty('--seq', '0.50');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(17, 24, 39)');

      /*
       * Still dark at 0.83, and this is the point of the case.
       *
       * The background is TRIGGERED at 0.78 but plays on a clock from there, so
       * position says nothing about how far up the screen the wall has got. The
       * heading used to go white here -- and on `data-bg-active`, which is set
       * on the rise's very first frame -- so in light mode it turned white
       * while the green was still a single row along the bottom, and sat
       * white-on-pale until the wall caught up.
       *
       * The heading reacting to the green is `TransitionMaskedOverlay`'s job:
       * it lays a white copy over the same pixel mask the rise is drawn from,
       * so the letters go white exactly where the green has reached and the
       * edge cuts through mid-letter. That only works if the heading
       * underneath is still its own colour.
       */
      container.style.setProperty('--seq', '0.83');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(17, 24, 39)');

      // And still dark while the rise is merely in flight.
      aboutSection.setAttribute('data-bg-active', 'true');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(17, 24, 39)');
      aboutSection.removeAttribute('data-bg-active');

      /*
       * `data-bg-transition` is NOT enough, and this is the case that says so.
       *
       * It lands at 95%, with the solid backdrop still fading up for another
       * 400ms -- and the heading sits at the top of the screen, the last place
       * a wall climbing from the bottom reaches. Taking the white there put
       * white letters on a pale ground for the length of that fade, so the
       * heading disappeared in the beat before it was due to be rewritten.
       */
      aboutSection.setAttribute('data-bg-transition', 'true');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(17, 24, 39)');

      // Only once the climb has genuinely finished does the real heading carry
      // the white on its own.
      aboutSection.setAttribute('data-bg-settled', 'true');
      container.style.setProperty('--seq', '0.856');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(255, 255, 255)');
      expect(heading.textContent).toBe('About Me');

      // When animating to Education at seq = 0.94: heading MUST remain white
      container.style.setProperty('--seq', '0.94');
      window.dispatchEvent(new Event('resize'));
      expect(heading.style.color).toBe('rgb(255, 255, 255)');
      expect(heading.textContent).toBe('Education');
    } finally {
      document.documentElement.removeAttribute('data-theme');
      aboutSection.remove();
    }
  });
});
