'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

/**
 * Native <select> on purpose: it gets the platform picker on mobile, keyboard
 * type-ahead for free, and adds nothing to the bundle. A custom listbox only
 * earns its weight when options need icons or descriptions.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, error, hint, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  return (
    <div className="w-full">
      <label htmlFor={selectId} className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}
      </label>

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(
            'h-11 w-full appearance-none rounded-md bg-surface-2 pl-3 pr-9 text-sm text-fg',
            'ring-1 ring-inset ring-line transition-[box-shadow,background-color] duration-150',
            'hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-iris-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'ring-loss focus:ring-loss',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-loss">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
