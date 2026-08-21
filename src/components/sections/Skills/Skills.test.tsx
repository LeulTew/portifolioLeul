import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skills } from './Skills';
import { cvData } from '../../../data/cv';

const skillCategories = cvData.skills;

describe('Skills', () => {
  it('renders the skills section', () => {
    render(<Skills />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Technical capabilities/i)).toBeInTheDocument();
  });

  it('renders all skill categories', () => {
    render(<Skills />);

    skillCategories.forEach(category => {
      expect(screen.getByLabelText(category.title)).toBeInTheDocument();
    });
  });

  it('renders all skills in each category', () => {
    render(<Skills />);

    skillCategories.forEach(category => {
      category.items.forEach(skill => {
        expect(screen.getByText(skill)).toBeInTheDocument();
      });
    });
  });

  it('renders skills as spans with correct structure', () => {
    render(<Skills />);

    const skills = skillCategories.flatMap(category => category.items);
    skills.forEach(skill => {
      const skillElement = screen.getByText(skill, { selector: 'span' });
      expect(skillElement).toBeInTheDocument();
      expect(skillElement.tagName).toBe('SPAN');
    });
  });

  it('has correct section structure', () => {
    render(<Skills />);

    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('id', 'skills');

    // Check that each category renders a heading
    const categoryHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(categoryHeadings).toHaveLength(skillCategories.length);
  });
});