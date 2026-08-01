import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/guard';
import { bucketByDay, bucketRevenue, computeAdminTotals } from '@/lib/admin/metrics';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

function money(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export default async function AdminOverview() {
  await requireAdmin();
  // The service role is used only after the guard has passed, and only for
  // aggregates — never to render one user's private rows to another.
  const admin = createAdminClient();

  const [{ data: profiles }, { data: subs }, { data: payments }, { count: tradeCount }, { count: newsletter }] =
    await Promise.all([
      admin.from('profiles').select('id, created_at').limit(50_000),
      admin.from('subscriptions').select('status, plan_id, plans(tier, interval, price_inr)').limit(50_000),
      admin.from('payments').select('created_at, amount_minor, currency, status').order('created_at', { ascending: false }).limit(2000),
      admin.from('trades').select('id', { count: 'exact', head: true }),
      admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
    ]);

  const samples = (subs ?? []).map((row) => {
    const plan = (row as unknown as { plans?: { tier: string; interval: string; price_inr: number } }).plans;
    return {
      status: row.status ?? '',
      interval: plan?.interval ?? 'month',
      tier: plan?.tier ?? 'free',
      priceMinor: (plan?.price_inr ?? 0) * 100,
    };
  });

  const totals = computeAdminTotals(profiles?.length ?? 0, samples);
  const signups = bucketByDay((profiles ?? []).map((p) => p.created_at), 30);
  const revenue = bucketRevenue(
    (payments ?? []).map((p) => ({
      createdAt: p.created_at,
      amountMinor: p.amount_minor,
      currency: p.currency,
      status: p.status,
    })),
  );

  const peak = Math.max(1, ...signups.map((point) => point.count));
  const last7 = signups.slice(-7).reduce((sum, point) => sum + point.count, 0);

  const cards = [
    { label: 'Users', value: String(totals.users), hint: `${last7} in the last 7 days` },
    { label: 'Paying', value: String(totals.payingUsers), hint: totals.conversionPct === null ? undefined : `${totals.conversionPct.toFixed(1)}% conversion` },
    { label: 'MRR', value: money(totals.mrrMinor), hint: 'annual plans amortised' },
    { label: 'Lifetime cash', value: money(totals.lifetimeMinor), hint: 'not counted in MRR' },
    { label: 'Trades logged', value: (tradeCount ?? 0).toLocaleString() },
    { label: 'Newsletter', value: String(newsletter ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-surface p-4">
            <p className="text-2xs tracking-wide text-fg-subtle uppercase">{card.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold tnum">{card.value}</p>
            {card.hint ? <p className="mt-0.5 text-2xs text-fg-subtle">{card.hint}</p> : null}
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Signups, last 30 days</h2>
        <div className="mt-4 flex h-24 items-end gap-1" role="img" aria-label={`${last7} signups in the last seven days`}>
          {signups.map((point) => (
            <div key={point.date} className="flex-1" title={`${point.date}: ${point.count}`}>
              <div
                className={cn(
                  'w-full rounded-sm transition-[height]',
                  point.count === 0 ? 'bg-surface-3' : 'bg-iris-500',
                )}
                style={{ height: `${Math.max(2, (point.count / peak) * 96)}px` }}
              />
            </div>
          ))}
        </div>
      </section>

      {revenue.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Revenue by month</h2>
          <ul className="divide-y divide-line text-sm">
            {revenue.slice(-12).reverse().map((point) => (
              <li key={point.month} className="flex items-center justify-between px-5 py-2.5">
                <span className="font-mono text-xs text-fg-muted tnum">{point.month}</span>
                <span className="font-mono font-medium tnum">{money(point.minor, point.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-xs text-fg-subtle">
          No payments yet.
        </p>
      )}
    </div>
  );
}
