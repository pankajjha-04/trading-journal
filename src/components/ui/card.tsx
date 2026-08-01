import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 'glass' for floating surfaces over content; 'solid' for dashboard panels. */
  surface?: 'solid' | 'glass';
  interactive?: boolean;
}

export function Card({
  className,
  surface = 'solid',
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        surface === 'glass'
          ? 'glass'
          : 'border border-line bg-surface shadow-e1',
        interactive &&
          'transition-[border-color,box-shadow,transform] duration-200 ease-[var(--ease-out-quint)] ' +
            'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-e2 motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-line px-5 py-3.5', className)}
      {...props}
    />
  );
}
