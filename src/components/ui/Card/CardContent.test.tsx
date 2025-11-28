import { render, screen } from '@testing-library/react';
import { CardTitle, CardText, StatsGrid, StatItem, TagsGrid, Tag } from './CardContent';

describe('CardContent Components', () => {
  describe('CardTitle', () => {
    it('renders title with correct attributes', () => {
      render(<CardTitle>Test Title</CardTitle>);

      const title = screen.getByText('Test Title');
      expect(title.tagName).toBe('H3');
      expect(title).toHaveAttribute('data-interactive', 'true');
    });
  });

  describe('CardText', () => {
    it('renders text with correct attributes', () => {
      render(<CardText>Test Text</CardText>);

      const text = screen.getByText('Test Text');
      expect(text.tagName).toBe('P');
      expect(text).toHaveAttribute('data-interactive', 'true');
    });
  });

  describe('StatsGrid', () => {
    it('renders children in stats grid', () => {
      render(
        <StatsGrid>
          <div>Stat 1</div>
          <div>Stat 2</div>
        </StatsGrid>
      );

      expect(screen.getByText('Stat 1')).toBeInTheDocument();
      expect(screen.getByText('Stat 2')).toBeInTheDocument();
    });
  });

  describe('StatItem', () => {
    it('renders stat item with value and label', () => {
      render(<StatItem value="95%" label="Completion" />);

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('Completion')).toBeInTheDocument();
    });

    it('has correct data attributes for interactivity', () => {
      render(<StatItem value="100" label="Score" />);

      const valueElement = screen.getByText('100');
      const labelElement = screen.getByText('Score');

      expect(valueElement).toHaveAttribute('data-interactive', 'true');
      expect(labelElement).toHaveAttribute('data-interactive', 'true');
    });
  });

  describe('TagsGrid', () => {
    it('renders children in tags grid', () => {
      render(
        <TagsGrid>
          <span>Tag 1</span>
          <span>Tag 2</span>
        </TagsGrid>
      );

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
    });
  });

  describe('Tag', () => {
    it('renders tag with correct attributes', () => {
      render(<Tag>React</Tag>);

      const tag = screen.getByText('React');
      expect(tag.tagName).toBe('SPAN');
      expect(tag).toHaveAttribute('data-interactive', 'true');
    });
  });
});