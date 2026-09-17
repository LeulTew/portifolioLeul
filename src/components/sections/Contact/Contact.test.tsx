import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Contact } from './Contact';
import { beginContactFlight, getContactView, parkContactSky, releaseContactSky, setContactProgress } from '@/lib/contact/contactScene';
import { paintContactPresentation } from '@/lib/contact/contactPresentation';
import { publishSectionNavigation } from '@/lib/scroll/sectionNavigation';
import emailjs from '@emailjs/browser';

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

  it('preserves the actual form and unsent field state across sky travel and navbar bypass', async () => {
    render(<Contact spatial />);
    const name = screen.getByRole('textbox', { name: 'Name' });
    const email = screen.getByRole('textbox', { name: 'Email' });
    const message = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(name, { target: { value: 'Unsent contact draft' } });
    fireEvent.change(email, { target: { value: 'draft@example.invalid' } });
    fireEvent.change(message, { target: { value: 'This must survive camera ownership changes.' } });
    const form = name.closest('form');
    await act(async () => beginContactFlight(1));
    await act(async () => parkContactSky());
    await act(async () => beginContactFlight(-1));
    await act(async () => releaseContactSky());
    await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
    expect(name.closest('form')).toBe(form);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(name);
    expect(name).toHaveValue('Unsent contact draft');
    expect(email).toHaveValue('draft@example.invalid');
    expect(message).toHaveValue('This must survive camera ownership changes.');
    expect(document.getElementById('contact')).toHaveAttribute('data-contact-ready', 'true');
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeEnabled();
    expect(emailjs.send).not.toHaveBeenCalled();
  });

  it('leaves the flat form available when its optional cloud images fail', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Contact />);
    for (const cloud of container.querySelectorAll('img')) fireEvent.error(cloud);
    await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
    expect(warning).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeEnabled();
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(emailjs.send).not.toHaveBeenCalled();
  });

  it('settles the entire heading on the first painted navbar bypass frame', async () => {
    const { container } = render(<Contact spatial />);
    await act(async () => publishSectionNavigation('contact', { source: 'navbar' }));
    await act(async () => { await new Promise(requestAnimationFrame); });
    for (const word of container.querySelectorAll<HTMLElement>('h2 span')) {
      expect(word.style.opacity).toBe('1');
      expect(word.style.transform).not.toContain('25px');
    }
  });

  it('pre-settles the actual heading and form during final easing while editing remains under the owner', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const { container } = render(<main style={{ visibility: 'hidden' }}><Contact spatial /></main>);
    const main = container.querySelector('main')!;
    main.setAttribute('inert', '');
    const section = document.getElementById('contact')!;
    const form = section.querySelector('form')!;
    await act(async () => {
      beginContactFlight(1);
      setContactProgress(0.94);
      paintContactPresentation();
    });
    await act(async () => { await new Promise(requestAnimationFrame); });
    expect(getContactView()).toMatchObject({ mode: 'departing', progress: 0.94, revealed: true });
    expect(section).toHaveAttribute('data-contact-presenting', 'true');
    expect(section.style.getPropertyValue('--contact-flight-reveal')).toBe('1');
    expect(form.parentElement!.style.opacity).toBe('1');
    expect(form.parentElement!.style.transform).not.toContain('-40px');
    for (const word of section.querySelectorAll<HTMLElement>('h2 span')) {
      expect(word.style.opacity).toBe('1');
      expect(word.style.transform).not.toContain('25px');
    }
    expect(main).toHaveAttribute('inert');
    expect(section.querySelector('form')).toBe(form);
    expect(section).toHaveAttribute('data-contact-ready', 'false');
    expect(emailjs.send).not.toHaveBeenCalled();
  });
});
