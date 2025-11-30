import { render, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { vi, describe, it, expect } from 'vitest';

// Mock framer-motion to ignore ref, simulating a scenario where ref is not attached
// or ensuring cardRef.current is null during render and event handling
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onMouseMove, onMouseLeave, className }: any) => (
      <div 
        className={className}
        onMouseMove={onMouseMove} 
        onMouseLeave={onMouseLeave}
        // ref is intentionally omitted to keep cardRef.current null
      >
        {children}
      </div>
    ),
  },
}));

describe('Card Coverage (Null Ref)', () => {
  it('handles null ref in useEffect and event handlers', () => {
    const { getByText } = render(
      <Card>
        <div>Content</div>
      </Card>
    );

    const card = getByText('Content').parentElement!;

    // Test line 48: handleMouseMove with null ref
    // Since ref is not attached, cardRef.current is null
    // Calling mouseMove should return early and not throw
    expect(() => {
      fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    }).not.toThrow();

    // Test line 80: handleMouseLeave with null ref
    expect(() => {
      fireEvent.mouseLeave(card);
    }).not.toThrow();
    
    // Line 18 (useEffect check) is covered implicitly by rendering without ref
  });
});
