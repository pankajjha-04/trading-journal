import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMembership, countTrades } from '@/lib/billing/entitlements';
import { isConfigured } from '@/lib/billing/checkout';
import { BillingPanel, type PlanOption } from '@/components/settings/billing-panel';
import { PlanStatus, buildUpgradeOffer } from '@/components/settings/plan-status';
import { FormAlert } from '@/components/auth/form-alert';

export const metadata: Metadata = {
  title: 'Billing',
  robots: { index: false, follow: false },
};

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { status } = await searchParams;

  const [membership, tradeCount, { data: plans }, { data: invoices }] = await Promise.all([
    getMembership(user.id),
    countTrades(user.id),
    supabase
      .from('plans')
      .select('id, name, tier, price_inr, price_usd, interval, features')
      .eq('is_active', true)
      .neq('tier', 'free'),
    supabase
      .from('invoices')
      .select('id, number, issued_on, total_minor, currency, tax_label')
      .eq('user_id', user.id)
      .order('issued_on', { ascending: false })
      .limit(12),
  ]);

  const options: PlanOption[] = (plans ?? [])
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      priceInr: plan.price_inr,
      priceUsd: plan.price_usd,
      interval: plan.interval,
      features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
    }))
    .sort((a, b) => a.priceInr - b.priceInr);

  return (
    <div className="space-y-6">
      {status === 'success' ? (
        <FormAlert
          tone="success"
          message="Payment received. If the plan below still says Free, give the webhook a few seconds and refresh."
        />
      ) : null}
      {status === 'cancelled' ? (
        <FormAlert tone="error" message="That checkout was cancelled. Nothing was charged." />
      ) : null}

      <PlanStatus
        membership={membership}
        offer={buildUpgradeOffer(
          (plans ?? []).map((plan) => ({
            id: plan.id,
            name: plan.name,
            interval: plan.interval,
            price_inr: plan.price_inr,
            tier: plan.tier,
          })),
          membership.planId,
        )}
        tradeCount={tradeCount}
      />

      <div id="plans" className="scroll-mt-6" />

      <BillingPanel
        plans={options}
        available={{
          stripe: isConfigured('stripe'),
          razorpay: isConfigured('razorpay'),
          crypto: isConfigured('crypto'),
        }}
        currentPlanId={membership.planId}
      />

      {invoices && invoices.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-semibold">Invoices</h2>
          <ul className="divide-y divide-line text-sm">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs tnum">{invoice.number}</p>
                  <p className="text-2xs text-fg-subtle">
                    {new Date(invoice.issued_on).toLocaleDateString()}
                    {invoice.tax_label ? ` · ${invoice.tax_label}` : ''}
                  </p>
                </div>
                <span className="font-mono text-sm tnum">
                  {money(invoice.total_minor, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
