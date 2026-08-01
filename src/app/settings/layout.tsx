import Link from 'next/link';
import { AppShell } from '@/components/dashboard/app-shell';
import { SettingsNav } from '@/components/settings/settings-nav';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Your profile, your accounts, and the parts that cannot be undone.
        </p>

        <SettingsNav />

        <div className="mt-8">{children}</div>
      </div>
    </AppShell>
  );
}
