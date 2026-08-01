import { NextResponse, type NextRequest } from 'next/server';
import { normaliseRazorpay, verifyRazorpay } from '@/lib/billing/webhooks';
import { fulfil } from '@/lib/billing/fulfil';

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });

  const payload = await request.text();
  const check = verifyRazorpay(payload, request.headers.get('x-razorpay-signature'), secret);

  if (!check.ok) {
    console.error('[webhook:razorpay] rejected —', check.reason);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(payload) as Record<string, unknown>;
  const result = await fulfil(
    'razorpay',
    normaliseRazorpay(event),
    request.headers.get('x-razorpay-event-id'),
    event,
  );

  return NextResponse.json({ received: true, ...result });
}
