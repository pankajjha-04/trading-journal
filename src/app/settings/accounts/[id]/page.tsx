import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { updateAccount } from '@/app/settings/actions';
import { AccountForm } from '@/app/dashboard/accounts/new/account-form';

export const metadata: Metadata = {
  title: 'Edit account',
  robots: { index: false, follow: false },
};

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, broker, market, currency, starting_balance')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) notFound();

  return (
    <div className="max-w-lg">
      <Link
        href="/settings/accounts"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to accounts
      </Link>

      <h2 className="mt-5 font-display text-lg font-semibold">Edit {account.name}</h2>
      <p className="mt-1 text-xs text-fg-muted">
        Changing the starting balance recalculates drawdown and return percentages.
      </p>

      <div className="mt-6">
        <AccountForm
          action={updateAccount.bind(null, account.id)}
          submitLabel="Save changes"
          defaults={{
            name: account.name,
            broker: account.broker,
            market: account.market,
            currency: account.currency,
            startingBalance: Number(account.starting_balance),
          }}
        />
      </div>
    </div>
  );
}
