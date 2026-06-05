'use client';

import { type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/Input';

interface InputRowProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  /** Disable the remove button (e.g. when only one row remains). */
  disableRemove?: boolean;
  placeholder?: string;
  ariaLabel: string;
}

/**
 * A single input row with a remove button on the right.
 * Used by the ladder game for the names and results columns.
 */
export function InputRow({
  value,
  onChange,
  onRemove,
  disableRemove,
  placeholder,
  ariaLabel,
  ...rest
}: InputRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1"
        {...rest}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disableRemove}
        aria-label={`${ariaLabel} 삭제`}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 3l8 8M11 3l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
