'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
}

/**
 * Label is required, not optional — a placeholder is not a label, and it
 * disappears the moment someone starts typing.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, trailingSlot, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}
      </label>

      <div className="relative">
        {leadingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(error && errorId, hint && hintId) || undefined}
          className={cn(
            'h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg',
            'ring-1 ring-inset ring-line transition-[box-shadow,background-color] duration-150',
            'placeholder:text-fg-subtle',
            'hover:bg-surface-3 focus:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-iris-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leadingIcon && 'pl-9',
            trailingSlot && 'pr-11',
            error && 'ring-loss focus:ring-loss',
            className,
          )}
          {...props}
        />

        {trailingSlot ? (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailingSlot}</span>
        ) : null}
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
