'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/settings', label: 'Profile' },
  { href: '/settings/accounts', label: 'Accounts' },
  { href: '/settings/strategies', label: 'Strategies' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/security', label: 'Security' },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Settings sections">
      {TABS.map(({ href, label }) => {
        const active = href === '/settings' ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative px-3 py-2 text-sm transition-colors',
              active ? 'font-medium text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {label}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-iris-500"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
