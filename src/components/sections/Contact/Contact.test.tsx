import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Contact } from './Contact';

describe('Contact Section Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders heading and title', () => {
    render(<Contact />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("Let's Connect")).toBeInTheDocument();
  });

  it('renders contact information items and social channel links', () => {
    render(<Contact />);
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    expect(screen.getByLabelText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByLabelText('Telegram')).toBeInTheDocument();
  });

  it('handles social link hover without crashing', () => {
    render(<Contact />);
    const githubLink = screen.getByLabelText('GitHub');
    fireEvent.mouseEnter(githubLink);
  });
});
