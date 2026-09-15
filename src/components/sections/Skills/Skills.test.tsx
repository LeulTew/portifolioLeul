import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skills } from './Skills';
import { cvData } from '../../../data/cv';

const skillCategories = cvData.skills;

describe('Skills', () => {
  it('renders the skills section', () => {
    render(<Skills />);

    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByText('The tools behind the work.')).toBeInTheDocument();
  });

  it('renders all skill categories', () => {
    render(<Skills />);

    skillCategories.forEach(category => {
      expect(screen.getByRole('article', { name: category.title })).toBeInTheDocument();
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

    const section = document.getElementById('skills');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('id', 'skills');

    // Check that each category renders a heading
    const categoryHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(categoryHeadings).toHaveLength(skillCategories.length);
  });

  it('keeps the complete toolkit readable without a staged viewport', () => {
    render(<Skills />);
    expect(screen.getByTestId('skills-stage')).toHaveAttribute('data-staged', 'false');
    expect(screen.queryByRole('button', { name: /^Next:/ })).not.toBeInTheDocument();
    skillCategories.forEach(category => {
      expect(screen.getByRole('heading', { name: category.title })).toBeVisible();
    });
  });

  it('gives every original category a distinct original instrument without a canvas', () => {
    const { container } = render(<Skills />);
    expect(container.querySelectorAll('article svg[viewBox="0 0 720 580"]')).toHaveLength(skillCategories.length);
    expect(container.querySelector('canvas, video, iframe')).toBeNull();
    const ids = [...container.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('authors compatible contour paths so morphing needs no additional plugin', () => {
    const { container } = render(<Skills />);
    const contours = [...container.querySelectorAll<SVGPathElement>('[data-art-morph]')];
    expect(contours.length).toBeGreaterThan(0);
    contours.forEach(path => {
      const from = path.dataset.morphFrom!;
      const to = path.getAttribute('d')!;
      expect(from.match(/[a-z]/gi)).toEqual(to.match(/[a-z]/gi));
      expect(from.match(/-?\d*\.?\d+/g)).toHaveLength(to.match(/-?\d*\.?\d+/g)!.length);
    });

  });

  it('uses a distinct primary visual subject for each capability', () => {
    render(<Skills />);
    const subjects = [
      'chip-pins', 'interface-system', 'neural-volume',
      'storage-tiers', 'vector-nib', 'collaborating-modules',
    ];
    skillCategories.forEach((category, index) => {
      const article = screen.getByRole('article', { name: category.title });
      expect(article.querySelector(`[data-asset-feature="${subjects[index]}"]`)).not.toBeNull();
    });
  });

  it('gives the neural instrument three physical layers and a clear data-to-model-to-output path', () => {
    render(<Skills />);
    const article = screen.getByRole('article', { name: 'AI & Data Science' });
    const sculpture = article.querySelector('[data-asset-feature="neural-volume"]')!;
    expect(sculpture.querySelectorAll('[data-neural-layer]')).toHaveLength(3);
    expect(sculpture.querySelectorAll('[data-neural-node]')).toHaveLength(10);
    expect(sculpture.querySelectorAll('[data-material-node]')).toHaveLength(3);
    expect(sculpture.querySelector('[data-neural-input]')).not.toBeNull();
    expect(sculpture.querySelector('[data-neural-output]')).not.toBeNull();
    expect(sculpture.querySelector('image, filter, foreignObject')).toBeNull();
    expect(sculpture.querySelectorAll('radialGradient')).toHaveLength(2);
    sculpture.querySelectorAll('[data-neural-node]').forEach(node => {
      expect(node.tagName.toLowerCase()).toBe('use');
      const href = node.getAttribute('href')!;
      expect(sculpture.querySelector(href)).not.toBeNull();
    });
  });
});