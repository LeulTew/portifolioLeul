import { ChevronDown } from 'lucide-react';
import styles from './IndexPicker.module.css';

interface IndexPickerProps {
  items: readonly { id: string | number; title: string }[];
  index: number;
  label: string;
  onSelect: (index: number) => void;
  disabled?: boolean;
  className?: string;
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
        {items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
    </label>
  );
}
