import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContactForm } from './useContactForm';

const TestComponent = ({ submitFn }: { submitFn?: () => Promise<void> } = {}) => {
  const {
    formData,
    errors,
    isSubmitting,
    submitStatus,
    handleSubmit,
    handleChange,
  } = useContactForm(submitFn);

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={formData.name}
        onChange={handleChange}
        data-testid="name-input"
      />
      {errors.name && <span data-testid="name-error">{errors.name}</span>}

      <input
        name="email"
        value={formData.email}
        onChange={handleChange}
        data-testid="email-input"
      />
      {errors.email && <span data-testid="email-error">{errors.email}</span>}

      <textarea
        name="message"
        value={formData.message}
        onChange={handleChange}
        data-testid="message-input"
      />
      {errors.message && <span data-testid="message-error">{errors.message}</span>}

      <button type="submit" disabled={isSubmitting} data-testid="submit-button">
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>

      {submitStatus === 'success' && <span data-testid="success-message">Success!</span>}
      {submitStatus === 'error' && <span data-testid="error-message">Error!</span>}
    </form>
  );
};

describe('useContactForm', () => {
  it('initializes with empty form data', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('name-input')).toHaveValue('');
    expect(screen.getByTestId('email-input')).toHaveValue('');
    expect(screen.getByTestId('message-input')).toHaveValue('');
  });

  it('updates form data on change', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    const nameInput = screen.getByTestId('name-input');
    const emailInput = screen.getByTestId('email-input');
    const messageInput = screen.getByTestId('message-input');

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.click(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('name-error')).toHaveTextContent('Name is required');
    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('message-error')).toHaveTextContent('Message is required');
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'invalid-email');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('email-error')).toHaveTextContent('Please enter a valid email address');
  });

  it('clears errors when user starts typing', async () => {
    const user = userEvent.setup();
    render(<TestComponent />);

    // Submit empty form to show errors
    await user.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('name-error')).toBeInTheDocument();

    // Start typing in name field
    await user.type(screen.getByTestId('name-input'), 'J');
    expect(screen.queryByTestId('name-error')).not.toBeInTheDocument();
  });

  it('handles submission error', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));
    render(<TestComponent submitFn={mockSubmit} />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(mockSubmit).toHaveBeenCalled();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Error!');
  });

  it('handles successful submission with custom submit function', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestComponent submitFn={mockSubmit} />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(mockSubmit).toHaveBeenCalled();
    expect(screen.getByTestId('success-message')).toHaveTextContent('Success!');
  });
});