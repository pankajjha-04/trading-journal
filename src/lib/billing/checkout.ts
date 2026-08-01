import 'server-only';

export type Provider = 'stripe' | 'razorpay' | 'crypto';

export interface CheckoutRequest {
  provider: Provider;
  planId: string;
  planName: string;
  userId: string;
  email: string;
  /** Minor units — paise for INR, cents for USD. */
  amountMinor: number;
  currency: 'INR' | 'USD';
  interval: 'month' | 'year' | 'once';
  siteUrl: string;
}

export class BillingError extends Error {
  constructor(
    message: string,
    readonly kind: 'config' | 'provider' | 'unsupported',
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

async function post(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Metadata is what ties a payment back to a user. Every provider gets the same
 * pair, because a webhook that cannot say who paid is worthless.
 */
async function stripeCheckout(request: CheckoutRequest): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingError('Stripe is not configured.', 'config');

  const body = new URLSearchParams({
    mode: request.interval === 'once' ? 'payment' : 'subscription',
    success_url: `${request.siteUrl}/settings/billing?status=success`,
    cancel_url: `${request.siteUrl}/settings/billing?status=cancelled`,
    customer_email: request.email,
    'metadata[user_id]': request.userId,
    'metadata[plan_id]': request.planId,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': request.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(request.amountMinor),
    'line_items[0][price_data][product_data][name]': request.planName,
  });

  if (request.interval !== 'once') {
    body.set('line_items[0][price_data][recurring][interval]', request.interval);
    body.set('subscription_data[metadata][user_id]', request.userId);
    body.set('subscription_data[metadata][plan_id]', request.planId);
  }

  const response = await post('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !json.url) {
    console.error('[billing:stripe]', response.status, json.error?.message);
    throw new BillingError('Stripe could not start that checkout.', 'provider');
  }
  return json.url;
}

async function razorpayCheckout(request: CheckoutRequest): Promise<string> {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new BillingError('Razorpay is not configured.', 'config');

  // A payment link rather than the embedded widget: it works without shipping
  // their script to every visitor, and it survives the user switching device.
  const response = await post('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: request.amountMinor,
      currency: request.currency,
      description: request.planName,
      customer: { email: request.email },
      notify: { email: true },
      notes: { user_id: request.userId, plan_id: request.planId },
      callback_url: `${request.siteUrl}/settings/billing?status=success`,
      callback_method: 'get',
    }),
  });

  const json = (await response.json()) as { short_url?: string; error?: { description?: string } };
  if (!response.ok || !json.short_url) {
    console.error('[billing:razorpay]', response.status, json.error?.description);
    throw new BillingError('Razorpay could not create that payment link.', 'provider');
  }
  return json.short_url;
}

async function cryptoCheckout(request: CheckoutRequest): Promise<string> {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new BillingError('Crypto payments are not configured.', 'config');

  const response = await post('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: request.amountMinor / 100,
      price_currency: request.currency.toLowerCase(),
      // No structured metadata field exists, so identity rides in order_id.
      order_id: `${request.userId}:${request.planId}`,
      order_description: request.planName,
      ipn_callback_url: `${request.siteUrl}/api/webhooks/crypto`,
      success_url: `${request.siteUrl}/settings/billing?status=success`,
      cancel_url: `${request.siteUrl}/settings/billing?status=cancelled`,
    }),
  });

  const json = (await response.json()) as { invoice_url?: string; message?: string };
  if (!response.ok || !json.invoice_url) {
    console.error('[billing:crypto]', response.status, json.message);
    throw new BillingError('The crypto invoice could not be created.', 'provider');
  }
  return json.invoice_url;
}

export async function createCheckout(request: CheckoutRequest): Promise<string> {
  switch (request.provider) {
    case 'stripe':
      return stripeCheckout(request);
    case 'razorpay':
      return razorpayCheckout(request);
    case 'crypto':
      return cryptoCheckout(request);
    default:
      throw new BillingError('That payment method is not supported.', 'unsupported');
  }
}

export function isConfigured(provider: Provider): boolean {
  switch (provider) {
    case 'stripe':
      return Boolean(process.env.STRIPE_SECRET_KEY);
    case 'razorpay':
      return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    case 'crypto':
      return Boolean(process.env.NOWPAYMENTS_API_KEY);
    default:
      return false;
  }
}
