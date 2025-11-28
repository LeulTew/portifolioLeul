import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormField from './FormField';

describe('FormField', () => {
  it('renders input field with correct props', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Test Label"
        id="test-field"
        value="test value"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Test Label');
    expect(input).toHaveAttribute('id', 'test-field');
    expect(input).toHaveAttribute('name', 'test-field');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('test value');
  });

  it('renders textarea when textarea prop is true', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Message"
        id="message"
        value="test message"
        onChange={handleChange}
        textarea
      />
    );

    const textarea = screen.getByLabelText('Message');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('rows', '4');
  });

  it('renders email input when type is email', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Email"
        id="email"
        type="email"
        value="test@example.com"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('calls onChange when input value changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <FormField
        label="Name"
        id="name"
        value=""
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Name');
    await user.type(input, 'John');

    expect(handleChange).toHaveBeenCalledTimes(4); // 'J', 'o', 'h', 'n'
  });

  it('displays error message when error prop is provided', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Name"
        id="name"
        value=""
        onChange={handleChange}
        error="Name is required"
      />
    );

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Name is required')).toHaveClass('text-red-500');
  });

  it('applies error styling to input when error exists', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Email"
        id="email"
        type="email"
        value=""
        onChange={handleChange}
        error="Invalid email"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveClass('border-red-500');
    expect(input).toHaveClass('focus:ring-red-500');
  });

  it('applies default styling when no error', () => {
    const handleChange = vi.fn();
    render(
      <FormField
        label="Name"
        id="name"
        value="John"
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Name');
    expect(input).toHaveClass('border-gray-300');
    expect(input).toHaveClass('dark:border-gray-700');
    expect(input).toHaveClass('focus:ring-primary-500');
  });
});