import Link from 'next/link';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils/cn';

const ORDER = ['free', 'pro_month', 'pro_year', 'lifetime'];

const INTERVAL_LABEL: Record<string, string> = {
  month: '/month',
  year: '/year',
  once: 'once',
};

/**
 * Prices come from the plans table, not from copy pasted into a component.
 * A price that lives in two places eventually disagrees with itself, and the
 * one people see is the one that is wrong.
 */
export async function Pricing() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, tier, price_inr, price_usd, interval, trade_limit, account_limit, features')
    .eq('is_active', true);

  const sorted = (plans ?? []).sort(
    (a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id),
  );

  if (sorted.length === 0) return null;

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
      <p className="text-2xs tracking-wide text-fg-subtle uppercase">Pricing</p>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-balance">
        Free until the journal is worth paying for.
      </h2>
      <p className="mt-4 max-w-xl text-fg-muted">
        Fifty trades is enough to see whether the breakdowns tell you anything.
        If they do not, you have lost nothing.
      </p>

      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {sorted.map((plan) => {
          const featured = plan.id === 'pro_year';
          const features = Array.isArray(plan.features) ? plan.features : [];

          return (
            <div
              key={plan.id}
              className={cn('relative bg-surface p-6', featured && 'bg-surface-2')}
            >
              {featured ? (
                <span className="absolute right-5 top-5 rounded-full bg-iris-500/15 px-2 py-0.5 text-2xs font-medium text-iris-300">
                  Best value
                </span>
              ) : null}

              <h3 className="text-sm font-semibold">{plan.name}</h3>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-semibold tnum">
                  ₹{plan.price_inr.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-fg-subtle">
                  {INTERVAL_LABEL[plan.interval] ?? ''}
                </span>
              </p>
              <p className="mt-1 font-mono text-2xs text-fg-subtle tnum">
                ${plan.price_usd} {INTERVAL_LABEL[plan.interval] ?? ''}
              </p>

              <ul className="mt-5 space-y-2">
                {features.map((feature) => (
                  <li key={String(feature)} className="flex gap-2 text-xs text-fg-muted">
                    <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gain" />
                    {String(feature)}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={cn(
                  'mt-6 flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors',
                  featured
                    ? 'bg-iris-500 text-white ring-1 ring-white/10 ring-inset hover:bg-iris-400'
                    : 'text-fg ring-1 ring-line ring-inset hover:bg-surface-3',
                )}
              >
                {plan.tier === 'free' ? 'Start free' : 'Choose ' + plan.name}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-fg-subtle">
        Prices in INR include 18% GST. Pay by card, UPI or crypto. Signing up
        starts you on the free plan — nothing is charged until you choose one.
      </p>
    </section>
  );
}
