import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Membership } from '@/lib/billing/entitlements';

export interface UpgradeOffer {
  planId: string;
  planName: string;
  /** Percent saved against paying monthly for a year. Null when not cheaper. */
  savingPct: number | null;
  priceInr: number;
  monthlyEquivalentInr: number;
}

function daysBetween(iso: string, now = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

/**
 * The renewal date matters more than the plan name. Someone who cannot tell
 * how long they have left assumes the worst, and a surprise lapse is how a
 * paying customer becomes an angry one.
 */
export function PlanStatus({
  membership,
  offer,
  tradeCount,
}: {
  membership: Membership;
  offer: UpgradeOffer | null;
  tradeCount: number;
}) {
  const limit = membership.entitlements.tradeLimit;
  const isFree = membership.entitlements.tier === 'free';
  const isLifetime = membership.entitlements.tier === 'lifetime';

  const daysLeft = membership.periodEnd ? daysBetween(membership.periodEnd) : null;
  const endingSoon = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const lapsed = daysLeft !== null && daysLeft < 0;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-surface',
        membership.status === 'past_due' || lapsed
          ? 'border-loss/40'
          : endingSoon
            ? 'border-warn/40'
            : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-2xs tracking-wide text-fg-subtle uppercase">Your plan</p>

          <h2 className="mt-1 flex flex-wrap items-center gap-2 font-display text-2xl font-semibold">
            {membership.planName}
            {isLifetime ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brass/15 px-2 py-0.5 text-2xs font-medium text-brass">
                <InfinityIcon aria-hidden className="size-3" />
                forever
              </span>
            ) : membership.isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-2 py-0.5 text-2xs font-medium text-gain">
                <Check aria-hidden className="size-3" />
                active
              </span>
            ) : null}
          </h2>

          {membership.status === 'past_due' ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-loss">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {/* Access is deliberately not cut off — a failed card is usually a
                  bank decline, not a decision to leave. */}
              Your last payment did not go through. Everything still works — update
              your card when you can.
            </p>
          ) : lapsed ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-loss">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              This plan ended {Math.abs(daysLeft!)} {Math.abs(daysLeft!) === 1 ? 'day' : 'days'} ago.
              Your trades and exports are untouched.
            </p>
          ) : daysLeft !== null ? (
            <p
              className={cn(
                'mt-2 flex items-center gap-2 text-sm',
                endingSoon ? 'text-warn' : 'text-fg-muted',
              )}
            >
              <Clock aria-hidden className="size-4 shrink-0" />
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left · renews{' '}
              {new Date(membership.periodEnd!).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          ) : isFree ? (
            <p className="mt-2 text-sm text-fg-muted">
              {limit === null
                ? 'No limits.'
                : `${tradeCount} of ${limit} trades used. Nothing is deleted when you reach it — you can still read and export everything.`}
            </p>
          ) : null}
        </div>

        {isFree && limit !== null ? (
          <div className="text-right">
            <p className="text-2xs tracking-wide text-fg-subtle uppercase">Trades</p>
            <p className="mt-1 font-mono text-2xl font-semibold tnum">
              {tradeCount}
              <span className="text-base text-fg-subtle">/{limit}</span>
            </p>
          </div>
        ) : null}
      </div>

      {isFree && limit !== null ? (
        <div className="px-5 pb-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500',
                tradeCount >= limit ? 'bg-loss' : tradeCount / limit > 0.8 ? 'bg-warn' : 'bg-iris-500',
              )}
              style={{ width: `${Math.min(100, (tradeCount / limit) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* The offer is computed from the real prices, so it can only claim a
          saving that actually exists. */}
      {offer && offer.savingPct !== null && offer.savingPct > 0 ? (
        <div className="border-t border-line bg-surface-2 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isFree ? 'Go annual' : 'Switch to annual'} and save {Math.round(offer.savingPct)}%
              </p>
              <p className="mt-0.5 text-xs text-fg-muted">
                ₹{offer.priceInr.toLocaleString('en-IN')} a year — works out to ₹
                {offer.monthlyEquivalentInr.toLocaleString('en-IN')} a month.
              </p>
            </div>

            <Link
              href="#plans"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-iris-500 px-4 text-xs font-medium text-white ring-1 ring-white/10 ring-inset transition-colors hover:bg-iris-400"
            >
              See {offer.planName}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Builds the annual offer by comparing real prices. If the yearly plan is not
 * actually cheaper than twelve monthly payments, nothing is offered — an
 * invented discount is the fastest way to lose a sceptical customer.
 */
export function buildUpgradeOffer(
  plans: { id: string; name: string; interval: string; price_inr: number; tier: string }[],
  currentPlanId: string | null,
): UpgradeOffer | null {
  const monthly = plans.find((plan) => plan.interval === 'month' && plan.tier !== 'free');
  const yearly = plans.find((plan) => plan.interval === 'year' && plan.tier !== 'free');

  if (!yearly) return null;
  if (currentPlanId === yearly.id) return null;

  const savingPct = monthly
    ? ((monthly.price_inr * 12 - yearly.price_inr) / (monthly.price_inr * 12)) * 100
    : null;

  return {
    planId: yearly.id,
    planName: yearly.name,
    savingPct,
    priceInr: yearly.price_inr,
    monthlyEquivalentInr: Math.round(yearly.price_inr / 12),
  };
}
