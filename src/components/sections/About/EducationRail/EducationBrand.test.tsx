import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EducationRecord } from './EducationRecord';
import { EDUCATION_RECORDS } from './educationRecords';

afterEach(cleanup);

describe('Boot.dev hover surface', () => {
  it('forwards the wheel without cancelling it or inventing a link or button', () => {
    const onWheel = vi.fn();
    render(
      <EducationRecord
        record={EDUCATION_RECORDS[2]}
        position={2}
        onWheel={onWheel}
        inactive={false}
        interactive={true}
      />
    );
    const brand = screen.getByRole('img', { name: 'Boot.dev' }).parentElement!;
    expect(fireEvent.wheel(brand, { deltaY: 120, cancelable: true })).toBe(true);
    expect(onWheel).toHaveBeenCalledOnce();
    expect(onWheel.mock.calls[0][0].deltaY).toBe(120);
    expect(onWheel.mock.calls[0][0].defaultPrevented).toBe(false);
    expect(brand.closest('a, button, [tabindex]')).toBeNull();
    expect(brand.querySelectorAll('img')).toHaveLength(2);
  });
});
