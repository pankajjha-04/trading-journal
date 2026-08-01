import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  checkAccountLimit,
  checkTradeLimit,
  entitlementsFor,
  usageRatio,
  FREE,
} from '@/lib/billing/plans';
import {
  hmacHex,
  normaliseCrypto,
  normaliseRazorpay,
  normaliseStripe,
  safeEqual,
  sortedJson,
  verifyCrypto,
  verifyRazorpay,
  verifyStripe,
} from '@/lib/billing/webhooks';

describe('entitlements', () => {
  it('gives an active pro subscriber the pro plan', () => {
    expect(entitlementsFor('pro', 'active').tradeLimit).toBeNull();
  });

  it('keeps a past-due subscriber working', () => {
    // A failed renewal is usually a bank decline, not a decision to leave.
    expect(entitlementsFor('pro', 'past_due').tradeLimit).toBeNull();
  });

  it('drops a cancelled or expired subscriber to free', () => {
    expect(entitlementsFor('pro', 'cancelled')).toEqual(FREE);
    expect(entitlementsFor('pro', 'expired')).toEqual(FREE);
  });

  it('ignores status for a lifetime purchase', () => {
    expect(entitlementsFor('lifetime', 'cancelled').tradeLimit).toBeNull();
  });

  it('falls back to free when nothing is known', () => {
    expect(entitlementsFor(null, null)).toEqual(FREE);
    expect(entitlementsFor(undefined, undefined)).toEqual(FREE);
  });

  it('never gates export, on any plan', () => {
    expect(FREE.canExport).toBe(true);
    expect(entitlementsFor('pro', 'active').canExport).toBe(true);
  });
});

describe('limits', () => {
  it('allows a trade below the free ceiling', () => {
    expect(checkTradeLimit(FREE, 49).allowed).toBe(true);
  });

  it('blocks the trade that would cross it', () => {
    const check = checkTradeLimit(FREE, 50);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('50 trades');
  });

  it('checks a whole import against the remaining space', () => {
    const check = checkTradeLimit(FREE, 40, 30);
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(10);
    expect(check.reason).toContain('10 are left');
  });

  it('never limits a paid plan', () => {
    const pro = entitlementsFor('pro', 'active');
    expect(checkTradeLimit(pro, 999_999, 5000).allowed).toBe(true);
    expect(checkAccountLimit(pro, 40).allowed).toBe(true);
  });

  it('reports usage as a ratio for the nudge before the wall', () => {
    expect(usageRatio(checkTradeLimit(FREE, 25))).toBe(0.5);
    expect(usageRatio(checkTradeLimit(entitlementsFor('pro', 'active'), 25))).toBeNull();
  });
});

describe('safeEqual', () => {
  it('matches identical strings and rejects everything else', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('verifyStripe', () => {
  const secret = 'whsec_test';
  const payload = '{"id":"evt_1"}';
  const now = 1_800_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const signature = hmacHex(secret, `${timestamp}.${payload}`);

  it('accepts a correct signature', () => {
    expect(
      verifyStripe(payload, `t=${timestamp},v1=${signature}`, secret, 300, now).ok,
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(
      verifyStripe('{"id":"evt_2"}', `t=${timestamp},v1=${signature}`, secret, 300, now).ok,
    ).toBe(false);
  });

  it('rejects a replay from outside the tolerance window', () => {
    const old = timestamp - 3600;
    const oldSig = hmacHex(secret, `${old}.${payload}`);
    const result = verifyStripe(payload, `t=${old},v1=${oldSig}`, secret, 300, now);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('tolerance');
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyStripe(payload, null, secret, 300, now).ok).toBe(false);
    expect(verifyStripe(payload, 'nonsense', secret, 300, now).ok).toBe(false);
  });

  it('rejects a signature made with the wrong secret', () => {
    const wrong = hmacHex('whsec_other', `${timestamp}.${payload}`);
    expect(verifyStripe(payload, `t=${timestamp},v1=${wrong}`, secret, 300, now).ok).toBe(false);
  });
});

describe('verifyRazorpay', () => {
  const secret = 'rzp_secret';
  const payload = '{"event":"payment.captured"}';

  it('accepts a correct signature and rejects a wrong one', () => {
    expect(verifyRazorpay(payload, hmacHex(secret, payload), secret).ok).toBe(true);
    expect(verifyRazorpay(payload, hmacHex('other', payload), secret).ok).toBe(false);
    expect(verifyRazorpay(payload, null, secret).ok).toBe(false);
  });
});

describe('verifyCrypto', () => {
  const secret = 'ipn_secret';
  const body = { payment_status: 'finished', order_id: 'u1:pro_month', price_amount: 12 };
  const sign = (value: unknown) =>
    createHmac('sha512', secret).update(sortedJson(value)).digest('hex');

  it('sorts keys before hashing, as the provider does', () => {
    const reordered = { price_amount: 12, order_id: 'u1:pro_month', payment_status: 'finished' };
    expect(sortedJson(body)).toBe(sortedJson(reordered));
    expect(verifyCrypto(reordered, sign(body), secret).ok).toBe(true);
  });

  it('rejects a changed amount', () => {
    expect(verifyCrypto({ ...body, price_amount: 1 }, sign(body), secret).ok).toBe(false);
  });
});

describe('normalising events', () => {
  it('reads a completed Stripe checkout', () => {
    const event = normaliseStripe({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          subscription: 'sub_1',
          amount_total: 99900,
          currency: 'inr',
          metadata: { user_id: 'u1', plan_id: 'pro_month' },
        },
      },
    });
    expect(event).toMatchObject({
      kind: 'activated',
      userId: 'u1',
      planId: 'pro_month',
      providerRef: 'sub_1',
      currency: 'INR',
    });
  });

  it('ignores Stripe events it does not handle', () => {
    expect(normaliseStripe({ type: 'customer.created', data: { object: {} } }).kind).toBe('ignored');
  });

  it('reads Razorpay notes as metadata', () => {
    const event = normaliseRazorpay({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', amount: 99900, currency: 'INR', notes: { user_id: 'u2', plan_id: 'pro_year' } } } },
    });
    expect(event).toMatchObject({ kind: 'activated', userId: 'u2', planId: 'pro_year' });
  });

  it('only activates crypto once the payment has settled', () => {
    // "confirmed" still has confirmations outstanding and can be reorged away.
    expect(normaliseCrypto({ payment_status: 'confirmed', order_id: 'u3:lifetime' }).kind).toBe('ignored');
    expect(normaliseCrypto({ payment_status: 'finished', order_id: 'u3:lifetime' }).kind).toBe('activated');
  });

  it('splits the crypto order id back into user and plan', () => {
    const event = normaliseCrypto({ payment_status: 'finished', order_id: 'u3:lifetime', payment_id: 991 });
    expect(event.userId).toBe('u3');
    expect(event.planId).toBe('lifetime');
    expect(event.providerRef).toBe('991');
  });

  it('treats a partial crypto payment as a failure, not a success', () => {
    expect(normaliseCrypto({ payment_status: 'partially_paid', order_id: 'u:p' }).kind).toBe('payment_failed');
  });
});

describe('buildUpgradeOffer', () => {
  const plans = [
    { id: 'pro_month', name: 'Pro Monthly', interval: 'month', price_inr: 799, tier: 'pro' },
    { id: 'pro_year', name: 'Pro Annual', interval: 'year', price_inr: 7999, tier: 'pro' },
  ];

  it('computes the saving from the real prices', async () => {
    const { buildUpgradeOffer } = await import('@/components/settings/plan-status');
    const offer = buildUpgradeOffer(plans, null);
    // 799 x 12 = 9588 against 7999.
    expect(Math.round(offer!.savingPct!)).toBe(17);
    expect(offer!.monthlyEquivalentInr).toBe(667);
  });

  it('offers nothing to someone already on the annual plan', async () => {
    const { buildUpgradeOffer } = await import('@/components/settings/plan-status');
    expect(buildUpgradeOffer(plans, 'pro_year')).toBeNull();
  });

  it('claims no saving when annual is not actually cheaper', async () => {
    const { buildUpgradeOffer } = await import('@/components/settings/plan-status');
    // An invented discount is the fastest way to lose a sceptical customer.
    const level = [
      { id: 'pro_month', name: 'Monthly', interval: 'month', price_inr: 500, tier: 'pro' },
      { id: 'pro_year', name: 'Annual', interval: 'year', price_inr: 6000, tier: 'pro' },
    ];
    expect(buildUpgradeOffer(level, null)!.savingPct).toBe(0);
  });

  it('returns null when there is no annual plan at all', async () => {
    const { buildUpgradeOffer } = await import('@/components/settings/plan-status');
    expect(buildUpgradeOffer([plans[0]!], null)).toBeNull();
  });
});
