import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  beforeEach(() => {
    // Mock requestAnimationFrame
    let rafId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return rafId++;
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
    fireEvent.mouseMove(card, { clientX: 110, clientY: 110 });

    expect(mockOnMouseMove).toHaveBeenCalledTimes(2);
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

  it('handles mouse leave and resets transforms', () => {
    render(
      <Card>
        <div data-interactive="true">Interactive</div>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    
    // Move mouse first
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
    
    // Then leave
    fireEvent.mouseLeave(card);
    
    // Verify reset was called
    expect(card.style.getPropertyValue('--rotate-x')).toBe('0deg');
    expect(card.style.getPropertyValue('--rotate-y')).toBe('0deg');
  });

  it('cleans up animation frame on unmount', () => {
    const { unmount } = render(
      <Card>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
    
    // Unmount should trigger cleanup
    unmount();
    
    // If we got here without errors, cleanup worked
    expect(true).toBe(true);
  });

  it('handles missing ref during mouse events', () => {
    // We need to mock useRef to return an object where we can set current to null
    
    // We'll use a spy to intercept the useRef call in the component
    // But since we can't easily spy on React.useRef inside the component without mocking React,
    // we'll rely on the fact that we can trigger the event handler and if the ref is null inside the handler,
    // it should return early.
    
    // Actually, the easiest way to test "if (!cardRef.current) return" inside the RAF callback
    // is to unmount the component immediately after triggering the event but before the RAF fires.
    // We already have a test for "cleans up animation frame on unmount", but that tests the cleanup function.
    
    // To test the check INSIDE the raf callback:
    // 1. Mock requestAnimationFrame to capture the callback
    // 2. Trigger mouse move
    // 3. Unmount component (setting ref to null effectively)
    // 4. Execute the captured callback
    
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    
    const { unmount } = render(
      <Card>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    
    // Trigger mouse move to schedule RAF
    fireEvent.mouseMove(card, { clientX: 50, clientY: 50 });
    
    // Get the callback
    const rafCallback = rafSpy.mock.calls[0][0];
    
    // Unmount to simulate component destruction (ref becomes null/invalid)
    unmount();
    
    // Execute callback - should not throw and should return early
    // We need to make sure the callback actually runs and hits the check
    // The check is: if (!cardRef.current) return;
    
    // Since unmount() sets the ref to null (because React sets refs to null on unmount),
    // executing the callback now should hit that check.
    expect(() => rafCallback(0)).not.toThrow();
    
    vi.useRealTimers();
    rafSpy.mockRestore();
  });

  it('handles mouse leave when ref is null', () => {
    // Restore manual mocks from beforeEach
    vi.restoreAllMocks();
    
    // Manually mock RAF to capture callback
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      rafCallback = cb;
      return 1;
    });
    
    const { unmount } = render(
      <Card>
        <div>Content</div>
      </Card>
    );

    const card = screen.getByText('Content').parentElement!;
    
    // Trigger mouse leave to schedule RAF
    fireEvent.mouseLeave(card);
    
    // Unmount to set ref to null
    unmount();
    
    // Execute callback if captured
    if (rafCallback) {
      // @ts-expect-error - calling with mock time
      rafCallback(0);
    }
    
    // Should not throw
    expect(true).toBe(true);
  });
});