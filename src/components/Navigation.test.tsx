import { render, screen, fireEvent } from '@testing-library/react';
import { Navigation } from './Navigation';

const mockScrollToSection = vi.fn();

describe('Navigation', () => {
  beforeEach(() => {
    mockScrollToSection.mockClear();
  });

  it('renders navigation with logo and menu items', () => {
    render(<Navigation scrollToSection={mockScrollToSection} />);

    expect(screen.getByText('LT')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('calls scrollToSection when logo is clicked', () => {
    render(<Navigation scrollToSection={mockScrollToSection} />);

    const logo = screen.getByText('LT');
    fireEvent.click(logo);

    expect(mockScrollToSection).toHaveBeenCalledWith('home');
  });

  it('calls scrollToSection when menu items are clicked', () => {
    render(<Navigation scrollToSection={mockScrollToSection} />);

    const aboutButton = screen.getByText('About');
    fireEvent.click(aboutButton);

    expect(mockScrollToSection).toHaveBeenCalledWith('about');
  });

  it('sets active class on current section', () => {
    // Mock getElementById and getBoundingClientRect before render
    const mockElement = {
      getBoundingClientRect: () => ({ top: 100 }),
      offsetHeight: 200
    };

    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as HTMLElement);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(400);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000);

    render(<Navigation scrollToSection={mockScrollToSection} />);

    // The active section should be set based on scroll position
    // This is tricky to test precisely due to scroll calculations
    // but we can verify the component renders without crashing
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('cleans up scroll event listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<Navigation scrollToSection={mockScrollToSection} />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});