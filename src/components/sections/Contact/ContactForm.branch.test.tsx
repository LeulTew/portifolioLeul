import { render, screen, waitFor } from '@testing-library/react';
import { ContactForm } from './ContactForm';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';

// Mock useContactForm to return specific states
vi.mock('./useContactForm', () => ({
  useContactForm: vi.fn(() => ({
    formData: { name: '', email: '', message: '' },
    handleChange: vi.fn(),
    handleSubmit: vi.fn((e) => e.preventDefault()),
    isSubmitting: false,
    submitStatus: 'error', // Force error state
    errors: {},
  })),
}));

describe('ContactForm Branch Coverage', () => {
  it('renders error message when submitStatus is error', () => {
    render(<ContactForm />);
    
    expect(screen.getByText('Failed to send message. Please try again.')).toBeInTheDocument();
  });
});
