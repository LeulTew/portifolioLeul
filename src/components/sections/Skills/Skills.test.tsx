import { render, screen } from '@testing-library/react';
import { Skills } from './Skills';

describe('Skills', () => {
  it('renders the skills section', () => {
    render(<Skills />);

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Technical capabilities and creative expertise')).toBeInTheDocument();
  });

  it('renders all skill categories', () => {
    render(<Skills />);

    expect(screen.getByText('Languages & Frameworks')).toBeInTheDocument();
    expect(screen.getByText('Tools & Software')).toBeInTheDocument();
    expect(screen.getByText('Multimedia Editing')).toBeInTheDocument();
  });

  it('renders all skills in each category', () => {
    render(<Skills />);

    // Languages & Frameworks
    expect(screen.getByText('C++')).toBeInTheDocument();
    expect(screen.getByText('C#')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('CSS')).toBeInTheDocument();
    expect(screen.getByText('PHP')).toBeInTheDocument();
    expect(screen.getByText('ASP.NET')).toBeInTheDocument();
    expect(screen.getByText('Three.js')).toBeInTheDocument();

    // Tools & Software
    expect(screen.getByText('Visual Studio')).toBeInTheDocument();
    expect(screen.getByText('Git')).toBeInTheDocument();
    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.getByText('Adobe Photoshop')).toBeInTheDocument();
    expect(screen.getByText('Adobe Express')).toBeInTheDocument();

    // Multimedia Editing
    expect(screen.getByText('Adobe Premiere Pro')).toBeInTheDocument();
    expect(screen.getByText('CapCut')).toBeInTheDocument();
  });

  it('renders skills as spans with correct structure', () => {
    render(<Skills />);

    const skillElements = screen.getAllByText(/^C\+\+|C#|JavaScript|HTML|CSS|PHP|ASP\.NET|Three\.js|Visual Studio|Git|Figma|Adobe Photoshop|Adobe Express|Adobe Premiere Pro|CapCut$/);
    expect(skillElements.length).toBeGreaterThan(0);

    // Check that skills are rendered as spans
    skillElements.forEach(skill => {
      expect(skill.tagName).toBe('SPAN');
    });
  });

  it('has correct section structure', () => {
    render(<Skills />);

    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();

    // Check for skill cards
    const skillCards = screen.getAllByText(/^Languages & Frameworks|Tools & Software|Multimedia Editing$/).map(el => el.closest('div'));
    expect(skillCards).toHaveLength(3);
  });
});