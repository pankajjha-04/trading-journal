import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import type { NormalisedEvent, PaymentEventKind } from './webhooks';

/**
 * Everything here runs on the service role, bypassing RLS. That is deliberate
 * and it is why webhooks are the only place it is used: a client that could
 * write its own subscription row could grant itself Lifetime for free.
 */

const STATUS_FOR: Record<PaymentEventKind, string | null> = {
  activated: 'active',
  renewed: 'active',
  payment_failed: 'past_due',
  cancelled: 'cancelled',
  ignored: null,
};

export interface FulfilResult {
  handled: boolean;
  reason?: string;
}

export async function fulfil(
  provider: 'stripe' | 'razorpay' | 'crypto',
  event: NormalisedEvent,
  eventId: string | null,
  raw: unknown,
): Promise<FulfilResult> {
  const status = STATUS_FOR[event.kind];
  if (!status) return { handled: false, reason: 'event not handled' };

  if (!event.userId || !event.planId) {
    // Without both we cannot say who bought what. Logging loudly beats
    // guessing — a wrong guess grants someone else's plan.
    console.error('[billing:fulfil] missing metadata', provider, event.kind);
    return { handled: false, reason: 'missing metadata' };
  }

  const admin = createAdminClient();

  const { data: plan } = await admin
    .from('plans')
    .select('id, tier, interval')
    .eq('id', event.planId)
    .maybeSingle();

  if (!plan) {
    console.error('[billing:fulfil] unknown plan', event.planId);
    return { handled: false, reason: 'unknown plan' };
  }

  // Webhooks are retried for days. Without this a retry would extend the
  // subscription a second time and issue a duplicate invoice.
  if (eventId) {
    const { data: seen } = await admin
      .from('payments')
      .select('id')
      .eq('provider', provider)
      .eq('event_id', eventId)
      .maybeSingle();

    if (seen) return { handled: true, reason: 'already processed' };
  }

  const paid = event.kind === 'activated' || event.kind === 'renewed';

  const { data: payment } = await admin
    .from('payments')
    .insert({
      user_id: event.userId,
      plan_id: plan.id,
      provider,
      provider_ref: event.providerRef,
      status: paid ? 'paid' : event.kind === 'cancelled' ? 'refunded' : 'failed',
      amount_minor: event.amountMinor ?? 0,
      currency: event.currency ?? 'INR',
      event_id: eventId,
      raw: raw as never,
    })
    .select('id')
    .maybeSingle();

  // A one-off purchase has no renewal date; a subscription gets one so access
  // lapses on its own if a cancellation webhook is ever missed.
  const periodEnd =
    event.periodEnd ??
    (plan.interval === 'once'
      ? null
      : new Date(
          Date.now() + (plan.interval === 'year' ? 365 : 31) * 86_400_000,
        ).toISOString());

  await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: event.userId,
        plan_id: plan.id,
        status: status as never,
        provider,
        provider_ref: event.providerRef,
        current_period_end: periodEnd,
        cancel_at_period_end: event.kind === 'cancelled',
      },
      { onConflict: 'user_id' },
    );

  if (paid && payment?.id && (event.amountMinor ?? 0) > 0) {
    await issueInvoice(event, payment.id, plan.id);
  }

  return { handled: true };
}

/**
 * Indian GST is inclusive of the displayed price, so tax is extracted from the
 * total rather than added to it — the customer paid what the pricing page said.
 */
const GST_RATE = 18;

async function issueInvoice(
  event: NormalisedEvent,
  paymentId: string,
  planId: string,
): Promise<void> {
  const admin = createAdminClient();
  const total = event.amountMinor ?? 0;
  const currency = event.currency ?? 'INR';

  const taxable = currency === 'INR';
  const subtotal = taxable ? Math.round(total / (1 + GST_RATE / 100)) : total;
  const tax = total - subtotal;

  const { data: numberRow } = await admin.rpc('next_invoice_number');

  const { error } = await admin.from('invoices').insert({
    user_id: event.userId!,
    payment_id: paymentId,
    number: (numberRow as unknown as string) ?? `LL/${Date.now()}`,
    issued_on: new Date().toISOString().slice(0, 10),
    subtotal_minor: subtotal,
    tax_minor: tax,
    total_minor: total,
    currency,
    tax_label: taxable ? `GST ${GST_RATE}% (inclusive)` : null,
    place_of_supply: taxable ? 'India' : null,
  });

  if (error) console.error('[billing:invoice]', planId, error.code, error.message);
}
