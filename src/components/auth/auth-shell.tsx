import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared frame for every auth screen: one column on mobile, a quiet proof
 * panel on the right from lg up. Keeps spacing and heading rhythm identical
 * across login, signup and reset, which is what makes the set feel designed.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 sm:px-10">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span aria-hidden className="size-2 rounded-full bg-iris-500" />
          Ledgerline
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 text-sm text-fg-muted">{footer}</div> : null}
        </div>

        <p className="text-2xs text-fg-subtle">
          Your trade data stays yours. Export it any time.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:block">
        <div aria-hidden className="grid-noise absolute inset-0" />
        <div className="relative flex h-full flex-col justify-center px-12">
          <blockquote className="max-w-md">
            <p className="font-display text-xl leading-snug text-balance">
              &ldquo;I thought my problem was entries. Six weeks of tagging showed it
              was Fridays after a losing Thursday.&rdquo;
            </p>
            <footer className="mt-4 text-sm text-fg-muted">
              A pattern you only find by writing it down
            </footer>
          </blockquote>

          <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-line pt-8">
            {[
              ['Metrics computed', '24'],
              ['Brokers supported', '8'],
              ['Your data, exportable', '100%'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-2xs tracking-wide text-fg-subtle uppercase">{label}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold tnum">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}
