import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Every webhook is an unauthenticated POST from the public internet. Without
 * signature verification, anyone who learns the URL can grant themselves a
 * lifetime plan with one curl command. This is the most security-critical
 * file in the billing module.
 */

/** Compares in constant time so a wrong signature cannot be guessed byte by byte. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length, so the length check is folded into the result.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function hmacHex(secret: string, payload: string, algorithm = 'sha256'): string {
  return createHmac(algorithm, secret).update(payload, 'utf8').digest('hex');
}

/**
 * Stripe signs `timestamp.payload` and sends both in one header. The timestamp
 * is checked too — without it a captured request could be replayed forever.
 */
export function verifyStripe(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Date.now(),
): { ok: boolean; reason?: string } {
  if (!header) return { ok: false, reason: 'missing signature' };

  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key ?? '', rest.join('=')];
    }),
  );

  const timestamp = Number(parts.t);
  const signature = parts.v1;

  if (!timestamp || !signature) return { ok: false, reason: 'malformed signature' };

  const age = Math.abs(now / 1000 - timestamp);
  if (age > toleranceSeconds) return { ok: false, reason: 'timestamp outside tolerance' };

  const expected = hmacHex(secret, `${timestamp}.${payload}`);
  return safeEqual(expected, signature)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' };
}

/** Razorpay signs the raw body with the webhook secret. */
export function verifyRazorpay(
  payload: string,
  header: string | null,
  secret: string,
): { ok: boolean; reason?: string } {
  if (!header) return { ok: false, reason: 'missing signature' };
  const expected = hmacHex(secret, payload);
  return safeEqual(expected, header)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' };
}

/**
 * NOWPayments sorts the JSON keys before signing, so the body has to be
 * re-serialised the same way rather than hashed as received.
 */
export function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${sortedJson(val)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function verifyCrypto(
  body: unknown,
  header: string | null,
  secret: string,
): { ok: boolean; reason?: string } {
  if (!header) return { ok: false, reason: 'missing signature' };
  const expected = createHmac('sha512', secret).update(sortedJson(body)).digest('hex');
  return safeEqual(expected, header)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' };
}

export type PaymentEventKind =
  | 'activated'
  | 'renewed'
  | 'payment_failed'
  | 'cancelled'
  | 'ignored';

export interface NormalisedEvent {
  kind: PaymentEventKind;
  /** Our own user id, carried through the provider as metadata. */
  userId: string | null;
  planId: string | null;
  providerRef: string | null;
  amountMinor: number | null;
  currency: string | null;
  periodEnd: string | null;
}

const EMPTY: NormalisedEvent = {
  kind: 'ignored',
  userId: null,
  planId: null,
  providerRef: null,
  amountMinor: null,
  currency: null,
  periodEnd: null,
};

/** Provider payloads differ wildly; the rest of the app only sees this shape. */
export function normaliseStripe(event: Record<string, any>): NormalisedEvent {
  const object = event?.data?.object ?? {};
  const metadata = object.metadata ?? {};

  const base: NormalisedEvent = {
    ...EMPTY,
    userId: metadata.user_id ?? null,
    planId: metadata.plan_id ?? null,
    providerRef: object.subscription ?? object.id ?? null,
    amountMinor: object.amount_total ?? object.amount_paid ?? null,
    currency: (object.currency ?? null)?.toUpperCase?.() ?? null,
    periodEnd: object.current_period_end
      ? new Date(object.current_period_end * 1000).toISOString()
      : null,
  };

  switch (event?.type) {
    case 'checkout.session.completed':
      return { ...base, kind: 'activated' };
    case 'invoice.paid':
      return { ...base, kind: 'renewed' };
    case 'invoice.payment_failed':
      return { ...base, kind: 'payment_failed' };
    case 'customer.subscription.deleted':
      return { ...base, kind: 'cancelled' };
    default:
      return { ...base, kind: 'ignored' };
  }
}

export function normaliseRazorpay(event: Record<string, any>): NormalisedEvent {
  const payment = event?.payload?.payment?.entity ?? {};
  const subscription = event?.payload?.subscription?.entity ?? {};
  const notes = payment.notes ?? subscription.notes ?? {};

  const base: NormalisedEvent = {
    ...EMPTY,
    userId: notes.user_id ?? null,
    planId: notes.plan_id ?? null,
    providerRef: subscription.id ?? payment.id ?? null,
    amountMinor: payment.amount ?? null,
    currency: payment.currency ?? null,
    periodEnd: subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null,
  };

  switch (event?.event) {
    case 'payment.captured':
    case 'subscription.activated':
      return { ...base, kind: 'activated' };
    case 'subscription.charged':
      return { ...base, kind: 'renewed' };
    case 'payment.failed':
      return { ...base, kind: 'payment_failed' };
    case 'subscription.cancelled':
    case 'subscription.halted':
      return { ...base, kind: 'cancelled' };
    default:
      return { ...base, kind: 'ignored' };
  }
}

export function normaliseCrypto(event: Record<string, any>): NormalisedEvent {
  // order_id carries "<userId>:<planId>" because the provider offers no
  // structured metadata field.
  const [userId = null, planId = null] = String(event?.order_id ?? '').split(':');

  const base: NormalisedEvent = {
    ...EMPTY,
    userId: userId || null,
    planId: planId || null,
    providerRef: event?.payment_id ? String(event.payment_id) : null,
    amountMinor:
      typeof event?.price_amount === 'number' ? Math.round(event.price_amount * 100) : null,
    currency: (event?.price_currency ?? null)?.toUpperCase?.() ?? null,
    periodEnd: null,
  };

  switch (event?.payment_status) {
    // "finished" is the only status where the funds have actually settled.
    // "confirmed" still has confirmations outstanding and can be reorged away.
    case 'finished':
      return { ...base, kind: 'activated' };
    case 'partially_paid':
    case 'failed':
    case 'expired':
      return { ...base, kind: 'payment_failed' };
    case 'refunded':
      return { ...base, kind: 'cancelled' };
    default:
      return { ...base, kind: 'ignored' };
  }
}
