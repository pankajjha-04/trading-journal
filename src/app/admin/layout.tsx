import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/dashboard/app-shell';
import { requireAdmin } from '@/lib/admin/guard';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/payments', label: 'Payments' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <ShieldCheck aria-hidden className="size-5 text-brass" />
            Admin
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Everything here is real user data. Look, do not experiment.
          </p>
        </div>

        <nav className="flex gap-1 border-b border-line" aria-label="Admin sections">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </AppShell>
  );
}
