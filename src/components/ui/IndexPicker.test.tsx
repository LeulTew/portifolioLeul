import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IndexPicker } from './IndexPicker';

const items = [{ id: 36, title: 'Mizan' }, { id: 23, title: 'Ignition' }, { id: 35, title: 'ProtoChem 3D' }];

function Picker() {
  const [index, setIndex] = useState(0);
  return <IndexPicker items={items} index={index} label="Choose a project" onSelect={setIndex} />;
}

it('keeps a real named native select with every item available for keyboard type-ahead', () => {
  render(<Picker />);
  const select = screen.getByRole('combobox', { name: 'Choose a project' });
  expect(select).toHaveValue('36');
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(items.map(item => item.title));
  fireEvent.change(select, { target: { value: '35' } });
  expect(select).toHaveValue('35');
  expect(select.closest('label')).toHaveTextContent('03/ 03');
});

it('lists grouped items under their group, keeping order and selection by index', () => {
  // Round 10 (D-BRAND-002): the lead set and the archive are named in the picker.
  const grouped = [
    { id: 23, title: 'Ignition', group: 'Selected work' }, { id: 4, title: 'Portfolio Leul', group: 'Selected work' },
    { id: 36, title: 'Mizan', group: 'Archive' },
  ];
  const onSelect = vi.fn();
  const { container } = render(<IndexPicker items={grouped} index={0} label="Choose a project" onSelect={onSelect} />);
  const groups = [...container.querySelectorAll('optgroup')];
  expect(groups.map(group => [group.label, [...group.querySelectorAll('option')].map(option => option.textContent)]))
    .toEqual([['Selected work', ['Ignition', 'Portfolio Leul']], ['Archive', ['Mizan']]]);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '36' } });
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('leaves native navigation keys and wheel uncanceled', () => {
  render(<Picker />);
  const select = screen.getByRole('combobox');
  for (const event of [
    new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }),
  ]) {
    fireEvent(select, event);
    expect(event.defaultPrevented).toBe(false);
  }
});

it.each([true, false])('keeps an unavailable picker disabled without a false selection (%s)', empty => {
  const change = vi.fn();
  render(<IndexPicker items={empty ? [] : items} index={0} label="Choose a project"
    disabled={!empty} onSelect={change} />);
  const select = screen.getByRole('combobox');
  expect(select).toBeDisabled();
  fireEvent.change(select, { target: { value: '23' } });
  expect(change).not.toHaveBeenCalled();
});

it('reports an unavailable selection rather than silently choosing another item', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const change = vi.fn();
  try {
    render(<IndexPicker items={items} index={0} label="Choose a project" onSelect={change} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'missing' } });
    expect(change).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith('The requested item is no longer available.');
  } finally {
    warn.mockRestore();
  }
});
