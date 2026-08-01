import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PasswordForm } from '@/components/settings/password-form';

export const metadata: Metadata = {
  title: 'Security settings',
  robots: { index: false, follow: false },
};

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Google users have no password to change, so offering the form would be a
  // dead end. Supabase records the providers on the identity list.
  const hasPassword = (user.identities ?? []).some((i) => i.provider === 'email');
  const providers = (user.identities ?? []).map((i) => i.provider);

  return (
    <div className="space-y-8">
      {hasPassword ? (
        <PasswordForm />
      ) : (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Password</h2>
          <p className="mt-1 text-xs text-fg-muted">
            You sign in with {providers.join(', ') || 'an external provider'}, so
            there is no password here to change. Manage it with that provider.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Sign-in methods</h2>
        <ul className="mt-3 space-y-2 text-xs text-fg-muted">
          {providers.length === 0 ? (
            <li>No providers recorded.</li>
          ) : (
            providers.map((provider) => (
              <li key={provider} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-gain" />
                {provider === 'email' ? 'Email and password' : provider}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
