'use client';

import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, rows = 4, ...props },
  ref,
) {
  const generatedId = useId();
  const areaId = id ?? generatedId;
  const errorId = `${areaId}-error`;
  const hintId = `${areaId}-hint`;

  return (
    <div className="w-full">
      <label htmlFor={areaId} className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}
      </label>
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn(
          'w-full resize-y rounded-md bg-surface-2 px-3 py-2.5 text-sm text-fg',
          'ring-1 ring-inset ring-line transition-[box-shadow,background-color] duration-150',
          'placeholder:text-fg-subtle',
          'hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-iris-500',
          error && 'ring-loss focus:ring-loss',
          className,
        )}
        {...props}
      />
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
