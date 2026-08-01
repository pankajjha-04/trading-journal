import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckout, isConfigured, BillingError, type Provider } from '@/lib/billing/checkout';

const PROVIDERS: Provider[] = ['stripe', 'razorpay', 'crypto'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = (await request.json()) as { planId?: string; provider?: string };
  const provider = PROVIDERS.find((p) => p === body.provider);

  if (!provider) return NextResponse.json({ error: 'Pick a payment method' }, { status: 400 });
  if (!isConfigured(provider)) {
    return NextResponse.json({ error: 'That method is not available yet' }, { status: 400 });
  }

  // The price comes from the database, never from the request. Trusting a
  // client-supplied amount is how people buy Lifetime for one rupee.
  const { data: plan } = await supabase
    .from('plans')
    .select('id, name, tier, price_inr, price_usd, interval, is_active')
    .eq('id', body.planId ?? '')
    .eq('is_active', true)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: 'Unknown plan' }, { status: 404 });
  if (plan.tier === 'free') {
    return NextResponse.json({ error: 'The free plan needs no checkout' }, { status: 400 });
  }

  // Stripe carries the international price; the Indian rails carry INR.
  const useUsd = provider === 'stripe' || provider === 'crypto';
  const amountMinor = useUsd ? plan.price_usd * 100 : plan.price_inr * 100;

  try {
    const url = await createCheckout({
      provider,
      planId: plan.id,
      planName: `Ledgerline ${plan.name}`,
      userId: user.id,
      email: user.email ?? '',
      amountMinor,
      currency: useUsd ? 'USD' : 'INR',
      interval: plan.interval as 'month' | 'year' | 'once',
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin,
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[checkout]', error);
    return NextResponse.json({ error: 'Checkout could not start' }, { status: 500 });
  }
}
