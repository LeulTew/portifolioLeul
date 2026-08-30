import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Education } from './Education';
import { EDUCATION_LAYERS, EDUCATION_SCREENS, ENTRY_NAMES } from './educationLayers';
import { windowPresence } from '@/lib/motion/sequenceWindow';
import { cvData } from '../../../data/cv';
import { groundFor } from '@/components/ui/GroundWash';

const layer = (name: string) => EDUCATION_LAYERS.find((l) => l.name === name)!;

describe('Education content', () => {
  it('carries the education entries, which moved out of About', () => {
    render(<Education />);
    expect(screen.getByText('Education')).toBeInTheDocument();
    for (const entry of cvData.education) {
      expect(screen.getByText(entry.school)).toBeInTheDocument();
      expect(screen.getByText(entry.degree)).toBeInTheDocument();
    }
  });

  it('carries the certifications, read normally past the held stretch', () => {
    render(<Education />);
    expect(screen.getByText('Certifications')).toBeInTheDocument();
    for (const cert of cvData.certifications) {
      expect(screen.getByText(cert.issuer)).toBeInTheDocument();
    }
  });
});

describe('Education portal', () => {
  it('holds the reader while the portal fills', () => {
    render(<Education />);
    const spacer = screen.getByTestId('education-sequence');
    expect(Number.parseFloat(spacer.style.height)).toBeGreaterThanOrEqual(200);
  });

  it('lengthens with the data rather than squeezing it', () => {
    // A fixed stretch means adding an entry silently shortens every other
    // entry's turn.
    expect(EDUCATION_SCREENS).toBe(cvData.education.length + 1);
  });

  it('gives every entry its own reveal', () => {
    render(<Education />);
    const entries = screen.getAllByTestId('education-entry');
    expect(entries).toHaveLength(cvData.education.length);

    const reveals = entries.map((e) => e.style.getPropertyValue('--reveal'));
    expect(new Set(reveals).size).toBe(entries.length);
    for (const name of ENTRY_NAMES) {
      expect(reveals.some((r) => r.includes(`--${name}-in`))).toBe(true);
    }
  });

  it('draws the frame before anything is inside it', () => {
    // An empty box that then fills, not a box that arrives already full.
    const frame = layer('frame');
    const firstEntry = layer(ENTRY_NAMES[0]);
    expect(frame.start).toBeLessThan(firstEntry.start);
  });

  it('opens the aperture only once the frame is established, and leaves it open', () => {
    const aperture = layer('aperture');
    expect(aperture.start).toBeGreaterThan(layer('frame').start);
    expect(aperture.end).toBe(1);
  });

  it('keeps the panel up for the whole stretch', () => {
    const panel = layer('panel');
    for (const at of [0.2, 0.5, 0.8]) {
      expect(windowPresence(at, panel.start, panel.end, panel.feather)).toBe(1);
    }
  });

  it('never leaves the portal empty between entries', () => {
    // Butt-jointed windows put a blank frame on screen at every handover.
    const entryLayers = ENTRY_NAMES.map(layer);
    for (let at = 0.2; at <= 0.92; at += 0.02) {
      const showing = entryLayers.some(
        (l) => windowPresence(at, l.start, l.end, l.feather!) > 0
      );
      expect(showing, `nothing on screen at ${at.toFixed(2)}`).toBe(true);
    }
  });
});

describe('Education ground', () => {
  it('does not carry a ground of its own', () => {
    // One ground spans the whole held run. A ground per section goes out at
    // the end of one and comes back at the start of the next, with the world
    // flashing through the gap between them.
    render(<Education />);
    expect(screen.queryByTestId('ground-wash')).toBeNull();
  });

  it('stands on a different depth from About, so the crossing shows', () => {
    expect(groundFor('education', 'dark').base).not.toBe(
      groundFor('about', 'dark').base
    );
  });
});
