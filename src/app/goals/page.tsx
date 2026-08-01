import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Target, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, toTrade } from '@/lib/data/trades';
import { computeGoalProgress, type GoalMetric, type GoalPeriod } from '@/lib/metrics';
import { GoalForm } from '@/components/goals/goal-form';
import { GoalCard } from '@/components/goals/goal-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Goals',
  robots: { index: false, follow: false },
};

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-surface">
        <EmptyState
          icon={<Wallet className="size-5" />}
          title="You need an account first"
          description="Goals are measured against one account's trades."
          action={
            <Link href="/dashboard/accounts/new">
              <Button>Create an account</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { data: goals } = await supabase
    .from('goals')
    .select('id, account_id, metric, period, target')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  // One fetch for every account that has a goal, rather than one per goal.
  const accountIds = [...new Set((goals ?? []).map((goal) => goal.account_id))].filter(
    (id): id is string => Boolean(id),
  );

  const { data: rows } = accountIds.length
    ? await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .in('account_id', accountIds)
        .limit(10_000)
    : { data: [] };

  const byAccount = new Map<string, ReturnType<typeof toTrade>[]>();
  for (const row of rows ?? []) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(toTrade(row));
    byAccount.set(row.account_id, list);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Goals</h1>
        <p className="mt-1 max-w-lg text-sm text-fg-muted">
          Measured against your logged trades as the period runs. A goal you
          cannot see progress on is just a wish.
        </p>
      </div>

      <GoalForm accounts={accounts} />

      {!goals || goals.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={<Target className="size-5" />}
            title="No goals set"
            description="Start with one. A stop-discipline target is usually worth more than a profit target — it is the part you actually control."
          />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => {
            const account = accounts.find((a) => a.id === goal.account_id);
            const trades = byAccount.get(goal.account_id ?? '') ?? [];
            const progress = computeGoalProgress(
              trades,
              goal.metric as GoalMetric,
              goal.period as GoalPeriod,
              Number(goal.target),
            );

            return (
              <GoalCard
                key={goal.id}
                id={goal.id}
                metric={goal.metric as GoalMetric}
                period={goal.period as GoalPeriod}
                accountName={account?.name ?? 'Unknown account'}
                currency={account?.currency ?? 'USD'}
                progress={progress}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
