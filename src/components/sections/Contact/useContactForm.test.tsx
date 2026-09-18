import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import emailjs from '@emailjs/browser';
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
  beforeEach(() => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', undefined);
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', undefined);
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', undefined);
    vi.mocked(emailjs.send).mockReset().mockResolvedValue({ status: 200, text: 'OK' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('initializes with empty form data', () => {
    render(<TestComponent />);

    expect(screen.getByTestId('name-input')).toHaveValue('');
    expect(screen.getByTestId('email-input')).toHaveValue('');
    expect(screen.getByTestId('message-input')).toHaveValue('');
  });

  it('updates form data on change', async () => {
    const user = userEvent.setup({ delay: null });
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
    const user = userEvent.setup({ delay: null });
    render(<TestComponent />);

    await user.click(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('name-error')).toHaveTextContent('Name is required');
    expect(screen.getByTestId('email-error')).toHaveTextContent('Email is required');
    expect(screen.getByTestId('message-error')).toHaveTextContent('Message is required');
  });

  it('validates email format', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestComponent />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'invalid-email');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(screen.getByTestId('email-error')).toHaveTextContent('Please enter a valid email address');
  });

  it('clears errors when user starts typing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<TestComponent />);

    // Submit empty form to show errors
    await user.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('name-error')).toBeInTheDocument();

    // Start typing in name field
    await user.type(screen.getByTestId('name-input'), 'J');
    expect(screen.queryByTestId('name-error')).not.toBeInTheDocument();
  });

  it('handles submission error', async () => {
    const user = userEvent.setup({ delay: null });
    const mockSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'));
    render(<TestComponent submitFn={mockSubmit} />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(mockSubmit).toHaveBeenCalled();
    expect(screen.getByTestId('error-message')).toHaveTextContent('Error!');
    expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toHaveValue('John');
    expect(screen.getByTestId('email-input')).toHaveValue('john@example.com');
    expect(screen.getByTestId('message-input')).toHaveValue('Message');
    expect(screen.getByTestId('submit-button')).toBeEnabled();
    expect(emailjs.send).not.toHaveBeenCalled();
  });

  it('handles successful submission with custom submit function', async () => {
    const user = userEvent.setup({ delay: null });
    const mockSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TestComponent submitFn={mockSubmit} />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));

    expect(mockSubmit).toHaveBeenCalled();
    expect(screen.getByTestId('success-message')).toHaveTextContent('Success!');
    expect(screen.getByTestId('name-input')).toHaveValue('');
    expect(screen.getByTestId('email-input')).toHaveValue('');
    expect(screen.getByTestId('message-input')).toHaveValue('');
    expect(screen.getByTestId('submit-button')).toBeEnabled();
    expect(emailjs.send).not.toHaveBeenCalled();
  });

  it.each([
    ['all settings absent', undefined, undefined, undefined],
    ['all settings empty', '', '', ''],
    ['only service configured', 'service_test', undefined, undefined],
    ['only template configured', undefined, 'template_test', undefined],
    ['only public key configured', undefined, undefined, 'public_test'],
    ['service missing', undefined, 'template_test', 'public_test'],
    ['template missing', 'service_test', undefined, 'public_test'],
    ['public key missing', 'service_test', 'template_test', undefined],
  ])('preserves input and reports an error with %s', async (_, serviceId, templateId, publicKey) => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', serviceId);
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', templateId);
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', publicKey);
    const user = userEvent.setup({ delay: null });
    render(<TestComponent />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => expect(screen.getByTestId('error-message')).toBeInTheDocument());
    expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toHaveValue('John');
    expect(screen.getByTestId('email-input')).toHaveValue('john@example.com');
    expect(screen.getByTestId('message-input')).toHaveValue('Message');
    expect(screen.getByTestId('submit-button')).toBeEnabled();
    expect(emailjs.send).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('EmailJS Error:', expect.any(Error));
  });

  it('waits for configured EmailJS delivery before reporting success and clearing input', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service_test');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template_test');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public_test');
    let resolveSend!: (response: { status: number; text: string }) => void;
    vi.mocked(emailjs.send).mockReturnValueOnce(new Promise(resolve => {
      resolveSend = resolve;
    }));
    const user = userEvent.setup({ delay: null });
    render(<TestComponent />);

    await user.type(screen.getByTestId('name-input'), 'John');
    await user.type(screen.getByTestId('email-input'), 'john@example.com');
    await user.type(screen.getByTestId('message-input'), 'Message');

    await user.click(screen.getByTestId('submit-button'));
    
    expect(screen.getByTestId('submit-button')).toBeDisabled();
    expect(screen.queryByTestId('success-message')).not.toBeInTheDocument();
    expect(screen.getByTestId('name-input')).toHaveValue('John');
    expect(emailjs.send).toHaveBeenCalledExactlyOnceWith(
      'service_test',
      'template_test',
      { from_name: 'John', from_email: 'john@example.com', message: 'Message' },
      'public_test'
    );

    await act(async () => resolveSend({ status: 200, text: 'OK' }));
    await waitFor(() => {
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
    expect(screen.getByTestId('name-input')).toHaveValue('');
    expect(screen.getByTestId('email-input')).toHaveValue('');
    expect(screen.getByTestId('message-input')).toHaveValue('');
    expect(screen.getByTestId('submit-button')).toBeEnabled();
  });

  it('sends only once for two same-frame submissions and protects the in-flight draft', async () => {
    let resolveSend!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { resolveSend = resolve; }));
    render(<TestComponent submitFn={submit} />);
    const name = screen.getByTestId('name-input');
    fireEvent.change(name, { target: { name: 'name', value: 'Leul' } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { name: 'email', value: 'leul@example.com' } });
    fireEvent.change(screen.getByTestId('message-input'), { target: { name: 'message', value: 'One message' } });
    act(() => {
      fireEvent.submit(name.closest('form')!);
      fireEvent.submit(name.closest('form')!);
    });
    expect(submit).toHaveBeenCalledOnce();
    fireEvent.change(name, { target: { name: 'name', value: 'Changed while sending' } });
    expect(name).toHaveValue('Leul');
    await act(async () => resolveSend());
    expect(name).toHaveValue('');
    expect(screen.getByTestId('success-message')).toBeInTheDocument();
  });

  it('normalizes surrounding email/config whitespace without altering the message body', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', ' service_test\n');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', ' template_test ');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', ' public_test ');
    render(<TestComponent />);
    const name = screen.getByTestId('name-input');
    fireEvent.change(name, { target: { name: 'name', value: ' Leul ' } });
    fireEvent.change(screen.getByTestId('email-input'), { target: { name: 'email', value: ' leul@example.com ' } });
    fireEvent.change(screen.getByTestId('message-input'), { target: { name: 'message', value: '  A message\nwith spacing' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(screen.getByTestId('success-message')).toBeInTheDocument());
    expect(emailjs.send).toHaveBeenCalledExactlyOnceWith(
      'service_test', 'template_test',
      { from_name: 'Leul', from_email: 'leul@example.com', message: '  A message\nwith spacing' },
      'public_test',
    );
  });
});