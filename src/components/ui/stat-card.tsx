'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { pnlTone } from '@/lib/utils/format';

interface StatCardProps {
  label: string;
  value: number | null;
  /** Turns the raw number into the string shown. Keeps formatting in one place. */
  format: (value: number | null) => string;
  /** Period-over-period change, already computed. */
  delta?: number | null;
  deltaFormat?: (value: number) => string;
  /** Colour the value by sign. Off for neutral metrics like trade count. */
  tone?: boolean;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}

const TONE_CLASS = {
  gain: 'text-gain',
  loss: 'text-loss',
  flat: 'text-fg',
} as const;

export function StatCard({
  label,
  value,
  format,
  delta,
  deltaFormat = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  tone = false,
  hint,
  icon,
  className,
}: StatCardProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No value, no motion preference, or off-screen: render the final string.
    if (value === null || reduceMotion || !inView) {
      node.textContent = format(value);
      return;
    }

    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });

    return () => controls.stop();
  }, [value, format, reduceMotion, inView]);

  const valueTone = tone ? pnlTone(value) : 'flat';
  const deltaTone = pnlTone(delta);
  const DeltaIcon =
    deltaTone === 'gain' ? ArrowUpRight : deltaTone === 'loss' ? ArrowDownRight : Minus;

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-line bg-surface p-5',
        'transition-colors duration-200 hover:border-line-strong',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{label}</p>
        {icon ? <span aria-hidden className="text-fg-subtle">{icon}</span> : null}
      </div>

      {/* The animated node is aria-hidden; a static copy carries the real value
          so assistive tech is not spammed with sixty intermediate readings. */}
      <p
        ref={ref}
        aria-hidden
        className={cn(
          'mt-3 font-mono text-2xl font-semibold tnum tabular-nums',
          TONE_CLASS[valueTone],
        )}
      >
        {format(value)}
      </p>
      <span className="sr-only">{`${label}: ${format(value)}`}</span>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta !== null && delta !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tnum',
              deltaTone === 'gain' && 'bg-gain-soft text-gain',
              deltaTone === 'loss' && 'bg-loss-soft text-loss',
              deltaTone === 'flat' && 'bg-surface-3 text-fg-subtle',
            )}
          >
            <DeltaIcon aria-hidden className="size-3" />
            {deltaFormat(delta)}
          </span>
        ) : null}
        {hint ? <span className="truncate text-fg-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}
