'use client';

import { useState, useTransition } from 'react';
import { Bitcoin, Check, CreditCard, IndianRupee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { cn } from '@/lib/utils/cn';

export interface PlanOption {
  id: string;
  name: string;
  tier: string;
  priceInr: number;
  priceUsd: number;
  interval: string;
  features: string[];
}

const METHODS = [
  { id: 'razorpay', label: 'Card or UPI', hint: 'Billed in ₹, GST invoice', icon: IndianRupee },
  { id: 'stripe', label: 'International card', hint: 'Billed in $', icon: CreditCard },
  { id: 'crypto', label: 'Crypto', hint: 'USDT, BTC, ETH and others', icon: Bitcoin },
] as const;

export function BillingPanel({
  plans,
  available,
  currentPlanId,
}: {
  plans: PlanOption[];
  available: Record<string, boolean>;
  currentPlanId: string | null;
}) {
  const [method, setMethod] = useState<string>(
    METHODS.find((m) => available[m.id])?.id ?? 'razorpay',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const usesUsd = method === 'stripe' || method === 'crypto';

  function checkout(planId: string) {
    setError(null);
    setBusy(planId);

    startTransition(async () => {
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, provider: method }),
        });
        const json = (await response.json()) as { url?: string; error?: string };

        if (!response.ok || !json.url) {
          setError(json.error ?? 'Checkout could not start.');
          setBusy(null);
          return;
        }
        window.location.href = json.url;
      } catch {
        setError('Could not reach the payment provider.');
        setBusy(null);
      }
    });
  }

  const anyAvailable = METHODS.some((m) => available[m.id]);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold">Upgrade</h2>
      <p className="mt-0.5 text-xs text-fg-muted">
        Cancel any time. Your trades and exports stay yours either way.
      </p>

      {!anyAvailable ? (
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-fg-muted">
          No payment method is configured on this server yet.
        </p>
      ) : null}

      {error ? <div className="mt-4"><FormAlert tone="error" message={error} /></div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {METHODS.map((option) => {
          const Icon = option.icon;
          const enabled = available[option.id];

          return (
            <button
              key={option.id}
              type="button"
              disabled={!enabled || pending}
              onClick={() => setMethod(option.id)}
              aria-pressed={method === option.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs ring-1 ring-inset transition-colors',
                method === option.id
                  ? 'bg-surface-2 text-fg ring-iris-500'
                  : 'text-fg-muted ring-line hover:bg-surface-2',
                !enabled && 'cursor-not-allowed opacity-40',
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-2xs text-fg-subtle">
                  {enabled ? option.hint : 'not available yet'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.id === currentPlanId;
          const featured = plan.id === 'pro_year';

          return (
            <div
              key={plan.id}
              className={cn(
                'rounded-lg border p-4',
                featured ? 'border-iris-500/40 bg-surface-2' : 'border-line',
              )}
            >
              <h3 className="text-sm font-semibold">{plan.name}</h3>
              <p className="mt-2 font-mono text-xl font-semibold tnum">
                {usesUsd
                  ? `$${plan.priceUsd}`
                  : `₹${plan.priceInr.toLocaleString('en-IN')}`}
                <span className="ml-1 text-xs font-normal text-fg-subtle">
                  {plan.interval === 'once' ? 'once' : `/${plan.interval}`}
                </span>
              </p>

              <ul className="mt-3 space-y-1.5">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex gap-2 text-2xs text-fg-muted">
                    <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-gain" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-4 w-full"
                size="sm"
                variant={featured ? 'primary' : 'outline'}
                disabled={current || !anyAvailable || pending}
                onClick={() => checkout(plan.id)}
              >
                {busy === plan.id ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : current ? (
                  'Current plan'
                ) : (
                  'Choose'
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {usesUsd ? null : (
        <p className="mt-4 text-2xs text-fg-subtle">
          Indian prices include 18% GST. A tax invoice is issued automatically.
        </p>
      )}
    </section>
  );
}
