import { NextResponse, type NextRequest } from 'next/server';
import { normaliseStripe, verifyStripe } from '@/lib/billing/webhooks';
import { fulfil } from '@/lib/billing/fulfil';

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });

  // The raw body, byte for byte. Parsing and re-serialising would change the
  // bytes and every signature would fail.
  const payload = await request.text();
  const check = verifyStripe(payload, request.headers.get('stripe-signature'), secret);

  if (!check.ok) {
    console.error('[webhook:stripe] rejected —', check.reason);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload) as Record<string, unknown>;
  const result = await fulfil(
    'stripe',
    normaliseStripe(event),
    typeof event.id === 'string' ? event.id : null,
    event,
  );

  // 200 even when unhandled: a non-2xx tells Stripe to keep retrying an event
  // we have deliberately ignored.
  return NextResponse.json({ received: true, ...result });
}
