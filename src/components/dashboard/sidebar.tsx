'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Calculator,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/coach', label: 'AI coach', icon: Sparkles },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/reflect', label: 'Reflect', icon: NotebookPen },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/tools', label: 'Calculators', icon: Calculator },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

function NavLinks({
  onNavigate,
  isAdmin,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  // Admin is appended rather than living in NAV, so a non-admin never even
  // receives the markup for it.
  const items = isAdmin
    ? [...NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck } as const]
    : NAV;

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
      {items.map(({ href, label, icon: Icon }) => {
        // Exact match for the index route, prefix match for the rest, so
        // /journal/123 still highlights Journal.
        const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-surface-3 font-medium text-fg'
                : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-iris-500"
              />
            ) : null}
            <Icon aria-hidden className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-6 py-5 text-sm font-semibold tracking-tight"
    >
      <span aria-hidden className="size-2 rounded-full bg-iris-500" />
      Ledgerline
    </Link>
  );
}

export function Sidebar({
  children,
  isAdmin,
}: {
  children?: React.ReactNode;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {children ? <div className="px-3 pb-4">{children}</div> : null}
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
          </div>
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Brand />
        {children ? <div className="px-3 pb-4">{children}</div> : null}
        <NavLinks isAdmin={isAdmin} />
      </aside>
    </>
  );
}
