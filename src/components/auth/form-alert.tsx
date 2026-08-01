import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * role="alert" so the message is announced the moment the action returns —
 * a form error nobody hears is a form error nobody fixes.
 */
export function FormAlert({
  message,
  tone,
  className,
}: {
  message: string;
  tone: 'error' | 'success';
  className?: string;
}) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-xs',
        tone === 'error'
          ? 'bg-loss-soft text-loss ring-1 ring-inset ring-loss/25'
          : 'bg-gain-soft text-gain ring-1 ring-inset ring-gain/25',
        className,
      )}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
