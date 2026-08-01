import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AccountRow } from '@/components/settings/account-row';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = {
  title: 'Account settings',
  robots: { index: false, follow: false },
};

export default async function AccountsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Archived accounts are listed here and nowhere else — this is the only
  // page where you can bring one back.
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, broker, market, currency, starting_balance, is_archived')
    .eq('user_id', user.id)
    .order('is_archived', { ascending: true })
    .order('created_at', { ascending: true });

  const counts = new Map<string, number>();
  const { data: trades } = await supabase
    .from('trades')
    .select('account_id')
    .eq('user_id', user.id);

  for (const row of trades ?? []) {
    counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-fg-muted">
          {accounts?.length ?? 0} {accounts?.length === 1 ? 'account' : 'accounts'}
        </p>
        <Link href="/dashboard/accounts/new">
          <Button size="sm" leadingIcon={<Plus className="size-4" />}>
            New account
          </Button>
        </Link>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            title="No accounts yet"
            description="An account is one broker or exchange balance."
            action={
              <Link href="/dashboard/accounts/new">
                <Button>Create an account</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              id={account.id}
              name={account.name}
              broker={account.broker}
              market={account.market}
              currency={account.currency}
              startingBalance={Number(account.starting_balance)}
              archived={account.is_archived}
              tradeCount={counts.get(account.id) ?? 0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
