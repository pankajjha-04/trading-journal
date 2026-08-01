import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * An empty screen is an instruction, not an apology. Every empty state names
 * what is missing and gives exactly one way to fix it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-5 flex size-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-fg-subtle"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
