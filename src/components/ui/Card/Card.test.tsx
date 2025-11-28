import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 0;
    });

    // Mock cancelAnimationFrame
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children correctly', () => {
    render(
      <Card>
        <div>Test Content</div>
      </Card>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Card className="custom-class">
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement;
    expect(card).toHaveClass('custom-class');
  });

  it('handles mouse move events', () => {
    const mockOnMouseMove = vi.fn();
    render(
      <Card onMouseMove={mockOnMouseMove}>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });

    expect(mockOnMouseMove).toHaveBeenCalled();
  });

  it('updates CSS custom properties on mouse move', () => {
    render(
      <Card>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    fireEvent.mouseMove(card, { clientX: 50, clientY: 50 });

    // Check if CSS custom properties are set
    expect(card.style.getPropertyValue('--mouse-x')).toBe('50px');
    expect(card.style.getPropertyValue('--mouse-y')).toBe('50px');
  });

  it('resets transform on mouse leave', () => {
    render(
      <Card>
        <div data-interactive="true">Interactive</div>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;

    // First move mouse to set intensity
    fireEvent.mouseMove(card, { clientX: 50, clientY: 50 });
    expect(card.style.getPropertyValue('--rotate-x')).toBeDefined();

    // Then leave
    fireEvent.mouseLeave(card);

    // Should reset transforms
    expect(card.style.getPropertyValue('--rotate-x')).toBe('0deg');
    expect(card.style.getPropertyValue('--rotate-y')).toBe('0deg');
  });

  it('handles elements with data-interactive attribute', () => {
    render(
      <Card>
        <div data-interactive="true">Interactive Element</div>
        <div>Non-interactive Element</div>
      </Card>
    );

    const card = screen.getByText('Interactive Element').parentElement!;
    fireEvent.mouseMove(card, { clientX: 25, clientY: 25 });

    // The interactive element should have intensity and lit attributes updated
    const interactiveElement = screen.getByText('Interactive Element');
    expect(interactiveElement).toHaveAttribute('data-lit');
    expect(interactiveElement.style.getPropertyValue('--intensity')).toBeDefined();
  });
});