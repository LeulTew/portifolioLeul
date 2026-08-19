import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ArchitecturalGrid } from './ArchitecturalGrid';
import { RotatingGear } from './RotatingGear';
import { WireframeSphere } from './WireframeSphere';

describe('Technical Assets & Visual Mechanisms', () => {
  describe('ArchitecturalGrid', () => {
    it('renders SVG grid pattern and coordinate telemetry tags', () => {
      const { container } = render(<ArchitecturalGrid theme="dark" showCoordinates={true} />);

      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText(/sys.coord:/i)).toBeInTheDocument();
      expect(screen.getByText(/clip-path:/i)).toBeInTheDocument();
    });

    it('hides coordinate telemetry when showCoordinates is false', () => {
      render(<ArchitecturalGrid theme="light" showCoordinates={false} />);
      expect(screen.queryByText(/sys.coord:/i)).not.toBeInTheDocument();
    });
  });

  describe('RotatingGear', () => {
    it('renders multi-tier planetary mechanism SVG', () => {
      const { container } = render(<RotatingGear theme="dark" speed={1.5} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(screen.getByText(/mech.rot/i)).toBeInTheDocument();
    });

    it('adapts styles for light theme', () => {
      const { container } = render(<RotatingGear theme="light" />);
      expect(container.querySelector('circle')).toBeInTheDocument();
    });
  });

  describe('WireframeSphere', () => {
    it('renders HTML5 canvas with Fibonacci coordinate metadata', () => {
      const { container } = render(<WireframeSphere theme="dark" size={200} interactive={false} />);
      expect(container.querySelector('canvas')).toBeInTheDocument();
      expect(screen.getByText(/orb.mesh/i)).toBeInTheDocument();
    });
  });
});
