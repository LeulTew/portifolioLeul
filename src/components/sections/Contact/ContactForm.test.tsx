import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    expect(nameInput).toHaveAttribute('readonly');
    expect(emailInput).toHaveAttribute('readonly');
    expect(messageInput).toHaveAttribute('readonly');
    expect(submitButton.closest('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Message sent successfully!')).not.toBeInTheDocument();

    await act(async () => resolveSend({ status: 200, text: 'OK' }));
    expect(submitButton).toBeDisabled();
    expect(nameInput).toHaveAttribute('readonly');
    expect(submitButton.closest('form')).toHaveAttribute('aria-busy', 'false');
    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    expect(submitButton).toBeEnabled();
    expect(nameInput).not.toHaveAttribute('readonly');
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

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(emailjs.send).toHaveBeenCalledExactlyOnceWith(
      'service_test',
      'template_test',
      { from_name: 'John Doe', from_email: 'john@example.com', message: 'Hello world' },
      'public_test'
    );
    expect(screen.getByRole('status')).toHaveTextContent('Message sent successfully!');

    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    expect(nameInput).toHaveFocus();
    expect(nameInput).toBe(screen.getByRole('textbox', { name: 'Name' }));
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(messageInput).toHaveValue('');
    await user.type(nameInput, '   ');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, '   ');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(submitButton);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(messageInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAccessibleDescription('Name is required');
    expect(messageInput).toHaveAccessibleDescription('Message is required');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(emailjs.send).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to send message');
    const fallback = screen.getByRole('link', { name: 'Open this draft in your email app' });
    const draft = new URL(fallback.getAttribute('href')!);
    expect(draft.protocol).toBe('mailto:');
    expect(draft.pathname).toBe('leulman2@gmail.com');
    expect(draft.searchParams.get('subject')).toBe('Portfolio message from John Doe');
    expect(draft.searchParams.get('body')).toBe('Name: John Doe\nEmail: john@example.com\n\nHello world');
  });

  it('shows field errors and clears them when the visitor corrects the draft', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);
    const name = screen.getByRole('textbox', { name: 'Name' });
    const email = screen.getByRole('textbox', { name: 'Email' });
    const message = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.submit(name.closest('form')!);
    expect(screen.getAllByRole('alert')).toHaveLength(3);
    expect(name).toHaveAccessibleDescription('Name is required');
    expect(email).toHaveAccessibleDescription('Email is required');
    expect(message).toHaveAccessibleDescription('Message is required');
    await user.type(name, 'Leul');
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
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
    expect(nameInput).toHaveValue('John Doe');
    expect(messageInput).toHaveValue('Hello world');
    await user.click(screen.getByRole('button', { name: 'Send another message' }));
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