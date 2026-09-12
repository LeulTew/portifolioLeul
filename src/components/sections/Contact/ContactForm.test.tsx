import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import emailjs from '@emailjs/browser';
import { ContactForm } from './ContactForm';

const configureEmailJs = () => {
  vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service_test');
  vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', 'template_test');
  vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public_test');
};

describe('ContactForm', () => {
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

  it('renders all form fields', () => {
    render(<ContactForm />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('updates form data on input change', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
  });

  it('shows loading state during submission', async () => {
    configureEmailJs();
    let resolveSend!: (response: { status: number; text: string }) => void;
    vi.mocked(emailjs.send).mockReturnValueOnce(new Promise(resolve => {
      resolveSend = resolve;
    }));
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Sending...');
    expect(screen.queryByText('Message sent successfully!')).not.toBeInTheDocument();

    await act(async () => resolveSend({ status: 200, text: 'OK' }));
    expect(submitButton).toBeEnabled();
  });

  it('shows success message on successful submission', async () => {
    configureEmailJs();
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Form should be cleared
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(messageInput).toHaveValue('');
    expect(emailjs.send).toHaveBeenCalledExactlyOnceWith(
      'service_test',
      'template_test',
      { from_name: 'John Doe', from_email: 'john@example.com', message: 'Hello world' },
      'public_test'
    );
  });

  it.each(['absent', 'incomplete'])('shows the error UI and retains input when EmailJS settings are %s', async (configuration) => {
    if (configuration === 'incomplete') {
      vi.stubEnv('VITE_EMAILJS_SERVICE_ID', 'service_test');
      vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', 'public_test');
    }
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send message. Please try again.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Message sent successfully!')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(submitButton).toBeEnabled();
    expect(emailjs.send).not.toHaveBeenCalled();
  });

  it('retains input and allows retry when configured delivery fails', async () => {
    configureEmailJs();
    vi.mocked(emailjs.send).mockRejectedValueOnce(new Error('Delivery failed'));
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByLabelText(/message/i);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to send message. Please try again.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Message sent successfully!')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText('Message sent successfully!')).toBeInTheDocument();
    });
    expect(screen.queryByText('Failed to send message. Please try again.')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(messageInput).toHaveValue('');
    expect(emailjs.send).toHaveBeenCalledTimes(2);
  });

  it('prevents form submission with empty required fields', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const submitButton = screen.getByRole('button', { name: /send message/i });

    await user.click(submitButton);

    // Form should not submit (no success/error messages appear)
    expect(screen.queryByText('Message sent successfully!')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to send message. Please try again.')).not.toBeInTheDocument();
  });
});