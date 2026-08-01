import { describe, expect, it } from 'vitest';
import { bucketByDay, bucketRevenue, computeAdminTotals } from '@/lib/admin/metrics';

describe('computeAdminTotals', () => {
  it('amortises an annual plan across twelve months', () => {
    const totals = computeAdminTotals(100, [
      { status: 'active', interval: 'year', tier: 'pro', priceMinor: 799_900 },
    ]);
    expect(totals.mrrMinor).toBe(66_658);
  });

  it('keeps lifetime out of MRR', () => {
    // Lifetime is cash, not recurring revenue. Folding it in flatters MRR.
    const totals = computeAdminTotals(10, [
      { status: 'active', interval: 'once', tier: 'lifetime', priceMinor: 1_999_900 },
    ]);
    expect(totals.mrrMinor).toBe(0);
    expect(totals.lifetimeMinor).toBe(1_999_900);
    expect(totals.payingUsers).toBe(1);
  });

  it('counts a past-due subscriber as active revenue', () => {
    const totals = computeAdminTotals(5, [
      { status: 'past_due', interval: 'month', tier: 'pro', priceMinor: 79_900 },
    ]);
    expect(totals.mrrMinor).toBe(79_900);
  });

  it('excludes cancelled and expired subscribers', () => {
    const totals = computeAdminTotals(5, [
      { status: 'cancelled', interval: 'month', tier: 'pro', priceMinor: 79_900 },
      { status: 'expired', interval: 'year', tier: 'pro', priceMinor: 799_900 },
    ]);
    expect(totals.mrrMinor).toBe(0);
    expect(totals.activeSubs).toBe(0);
  });

  it('does not count a free plan as a paying user', () => {
    const totals = computeAdminTotals(10, [
      { status: 'active', interval: 'month', tier: 'free', priceMinor: 0 },
    ]);
    expect(totals.payingUsers).toBe(0);
    expect(totals.conversionPct).toBe(0);
  });

  it('reports conversion as null rather than zero with no users', () => {
    expect(computeAdminTotals(0, []).conversionPct).toBeNull();
  });
});

describe('bucketByDay', () => {
  const now = new Date('2026-03-10T12:00:00');

  it('zero-fills days with no signups so gaps are visible', () => {
    const points = bucketByDay(['2026-03-10T09:00:00Z'], 5, now);
    expect(points).toHaveLength(5);
    expect(points[4]).toEqual({ date: '2026-03-10', count: 1 });
    expect(points[0]!.count).toBe(0);
  });

  it('counts several on the same day', () => {
    const points = bucketByDay(
      ['2026-03-09T01:00:00Z', '2026-03-09T22:00:00Z'],
      3,
      now,
    );
    expect(points[1]).toEqual({ date: '2026-03-09', count: 2 });
  });

  it('ends on today, not tomorrow', () => {
    const points = bucketByDay([], 7, now);
    expect(points[points.length - 1]!.date).toBe('2026-03-10');
  });
});

describe('bucketRevenue', () => {
  it('sums paid payments by month, oldest first', () => {
    const points = bucketRevenue([
      { createdAt: '2026-02-14T10:00:00Z', amountMinor: 49_900, currency: 'INR', status: 'paid' },
      { createdAt: '2026-03-01T10:00:00Z', amountMinor: 79_900, currency: 'INR', status: 'paid' },
      { createdAt: '2026-03-08T10:00:00Z', amountMinor: 49_900, currency: 'INR', status: 'paid' },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ month: '2026-02', minor: 49_900 });
    expect(points[1]!.minor).toBe(129_800);
  });

  it('ignores failed and refunded payments', () => {
    const points = bucketRevenue([
      { createdAt: '2026-03-01T10:00:00Z', amountMinor: 79_900, currency: 'INR', status: 'failed' },
      { createdAt: '2026-03-02T10:00:00Z', amountMinor: 79_900, currency: 'INR', status: 'refunded' },
    ]);
    expect(points).toHaveLength(0);
  });
});
