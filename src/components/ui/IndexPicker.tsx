import { ChevronDown } from 'lucide-react';
import styles from './IndexPicker.module.css';

interface IndexPickerItem {
  id: string | number;
  title: string;
  /** Consecutive items with the same group are listed under it. */
  group?: string;
}

interface IndexPickerProps {
  items: readonly IndexPickerItem[];
  index: number;
  label: string;
  onSelect: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

const option = (item: IndexPickerItem) => <option key={item.id} value={item.id}>{item.title}</option>;

/** Consecutive items sharing a group, in order; ungrouped items form runs without one. */
function groupRuns(items: readonly IndexPickerItem[]) {
  const runs: { group?: string; members: IndexPickerItem[] }[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && last.group === item.group) last.members.push(item);
    else runs.push({ group: item.group, members: [item] });
  }
  return runs;
}

export function IndexPicker({ items, index, label, onSelect, disabled = false, className }: IndexPickerProps) {
  const unavailable = disabled || items.length === 0;
  return (
    <label className={[styles.picker, className].filter(Boolean).join(' ')}
      data-disabled={unavailable || undefined} title={label}>
      <span className={styles.face} aria-hidden="true">
        <span>{String(items.length ? index + 1 : 0).padStart(2, '0')}</span>
        <span className={styles.total}>/ {String(items.length).padStart(2, '0')}</span>
        <ChevronDown size={15} strokeWidth={1.6} />
      </span>
      <select aria-label={label} value={items[index]?.id ?? ''} disabled={unavailable}
        onChange={event => {
          if (unavailable) return;
          const selected = items.findIndex(item => String(item.id) === event.currentTarget.value);
          if (selected < 0) {
            console.warn('The requested item is no longer available.');
            return;
          }
          onSelect(selected);
        }}>
        {groupRuns(items).map(({ group, members }) => group
          ? <optgroup key={`group:${group}:${members[0].id}`} label={group}>{members.map(option)}</optgroup>
          : members.map(option))}
      </select>
    </label>
  );
}
