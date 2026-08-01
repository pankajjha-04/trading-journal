import { NextResponse, type NextRequest } from 'next/server';
import { normaliseCrypto, verifyCrypto } from '@/lib/billing/webhooks';
import { fulfil } from '@/lib/billing/fulfil';

export async function POST(request: NextRequest) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });

  const body = (await request.json()) as Record<string, unknown>;
  const check = verifyCrypto(body, request.headers.get('x-nowpayments-sig'), secret);

  if (!check.ok) {
    console.error('[webhook:crypto] rejected —', check.reason);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const result = await fulfil(
    'crypto',
    normaliseCrypto(body),
    body.payment_id === undefined || body.payment_id === null
      ? null
      : String(body.payment_id),
    body,
  );

  return NextResponse.json({ received: true, ...result });
}
