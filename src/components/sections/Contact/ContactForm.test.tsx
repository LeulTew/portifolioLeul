import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactDeliveryError, sendContactMessage } from './contactDelivery';
import { ContactForm } from './ContactForm';
import { CONTACT_COUNT_FROM, CONTACT_LIMITS } from './contactLimits';

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
    vi.mocked(sendContactMessage).mockReset().mockResolvedValue(undefined);
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
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('bounds every field and counts characters only near the message limit', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('maxlength', String(CONTACT_LIMITS.name));
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('maxlength', String(CONTACT_LIMITS.email));
    const message = screen.getByRole('textbox', { name: 'Message' });
    expect(message).toHaveAttribute('maxlength', String(CONTACT_LIMITS.message));

    fireEvent.change(message, { target: { value: 'x'.repeat(CONTACT_COUNT_FROM - 1) } });
    expect(screen.queryByText(/ characters$/)).not.toBeInTheDocument();
    expect(message).not.toHaveAttribute('aria-describedby');

    fireEvent.change(message, { target: { value: 'x'.repeat(CONTACT_COUNT_FROM) } });
    expect(screen.getByText(
      `${CONTACT_COUNT_FROM.toLocaleString('en-US')} / ${CONTACT_LIMITS.message.toLocaleString('en-US')} characters`,
    )).toHaveAttribute('id', 'contact-message-count');
    expect(message).toHaveAttribute('aria-describedby', 'contact-message-count');
  });

  it('updates form data on input change', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByRole('textbox', { name: 'Message' });

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
  });

  it('shows loading state during submission', async () => {
    configureEmailJs();
    let resolveSend!: () => void;
    vi.mocked(sendContactMessage).mockReturnValueOnce(new Promise(resolve => {
      resolveSend = resolve;
    }));
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByRole('textbox', { name: 'Message' });
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
    expect(screen.getByRole('group', { name: 'Message submission' })).toHaveFocus();
    expect(screen.queryByText('The email service accepted your message.')).not.toBeInTheDocument();

    await act(async () => resolveSend());
    expect(submitButton).toBeDisabled();
    expect(nameInput).toHaveAttribute('readonly');
    expect(submitButton.closest('form')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('button', { name: 'Send another message' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    expect(submitButton).toBeEnabled();
    expect(nameInput).not.toHaveAttribute('readonly');
  });

  it('confirms provider acceptance without claiming inbox receipt', async () => {
    configureEmailJs();
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByRole('textbox', { name: 'Message' });
    const submitButton = screen.getByRole('button', { name: /send message/i });

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');

    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('The email service accepted your message.')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(sendContactMessage).toHaveBeenCalledExactlyOnceWith(
      { name: 'John Doe', email: 'john@example.com', message: 'Hello world' },
      { serviceId: 'service_test', templateId: 'template_test', publicKey: 'public_test' },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('status')).toHaveTextContent('The email service accepted your message.');
    expect(screen.getByText(/Inbox delivery isn't confirmed here/)).toBeInTheDocument();
    const followup = new URL(screen.getByRole('link', { name: 'Open this draft in your email app' }).getAttribute('href')!);
    expect(followup.searchParams.get('body')).toContain('Hello world');

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
    expect(nameInput).toHaveFocus();
    expect(messageInput).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput).toHaveAccessibleDescription('Name is required');
    expect(messageInput).toHaveAccessibleDescription('Message is required');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(sendContactMessage).toHaveBeenCalledTimes(1);
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
    const messageInput = screen.getByRole('textbox', { name: 'Message' });
    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('The form is unavailable right now. You can still email me directly.')).toBeInTheDocument();
    });
    expect(screen.queryByText('The email service accepted your message.')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(submitButton).toBeEnabled();
    expect(sendContactMessage).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('The form is unavailable right now.');
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
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it('retains input and allows retry when configured delivery fails', async () => {
    configureEmailJs();
    vi.mocked(sendContactMessage).mockRejectedValueOnce(new Error('Delivery failed'));
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const messageInput = screen.getByRole('textbox', { name: 'Message' });
    const submitButton = screen.getByRole('button', { name: /send message/i });
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');
    await user.type(messageInput, 'Hello world');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("We couldn't confirm submission. Your draft is still here.")).toBeInTheDocument();
    });
    expect(screen.queryByText('The email service accepted your message.')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
    expect(messageInput).toHaveValue('Hello world');
    expect(submitButton).toBeEnabled();
    expect(submitButton).toHaveFocus();

    await user.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText('The email service accepted your message.')).toBeInTheDocument();
    });
    expect(screen.queryByText("We couldn't confirm submission. Your draft is still here.")).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('John Doe');
    expect(messageInput).toHaveValue('Hello world');
    await user.click(screen.getByRole('button', { name: 'Send another message' }));
    expect(nameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');
    expect(messageInput).toHaveValue('');
    expect(sendContactMessage).toHaveBeenCalledTimes(2);
  });

  it('prevents form submission with empty required fields', async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    const submitButton = screen.getByRole('button', { name: /send message/i });

    await user.click(submitButton);

    // Form should not submit (no success/error messages appear)
    expect(screen.queryByText('The email service accepted your message.')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['timeout', "The email service didn't respond in time."],
    ['rate-limit', 'Wait a minute before trying again'],
    ['rejected', "The email service couldn't accept this message."],
  ] as const)('retains the draft and exposes the %s recovery without starting a flight', async (kind, text) => {
    configureEmailJs();
    vi.mocked(sendContactMessage).mockRejectedValueOnce(new ContactDeliveryError(kind));
    render(<ContactForm />);
    const name = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Leul' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'leul@example.com' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Keep this draft' } });
    fireEvent.submit(name.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(name).toHaveValue('Leul');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Keep this draft');
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeEnabled();
    expect(name.closest('[data-send-phase]')).toHaveAttribute('data-send-phase', 'ready');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(sendContactMessage).toHaveBeenCalledOnce();
  });

  it('does not restore submission focus over a visitor who moved elsewhere while waiting', async () => {
    configureEmailJs();
    let rejectSend!: (error: Error) => void;
    vi.mocked(sendContactMessage).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectSend = reject; }));
    const user = userEvent.setup({ delay: null });
    render(<><button>Elsewhere</button><ContactForm /></>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Leul' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), { target: { value: 'qa@example.invalid' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'One draft' } });
    await user.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(screen.getByRole('group', { name: 'Message submission' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await act(async () => rejectSend(new ContactDeliveryError('network')));
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't confirm submission.");
  });
});