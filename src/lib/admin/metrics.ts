export interface SignupPoint {
  date: string;
  count: number;
}

export interface RevenuePoint {
  month: string;
  minor: number;
  currency: string;
}

export interface AdminTotals {
  users: number;
  activeSubs: number;
  payingUsers: number;
  /** Monthly recurring revenue in minor units, annual plans amortised. */
  mrrMinor: number;
  lifetimeMinor: number;
  conversionPct: number | null;
}

export interface SubscriptionSample {
  status: string;
  interval: string;
  tier: string;
  priceMinor: number;
}

const ACTIVE = ['trialing', 'active', 'past_due'];

/**
 * MRR with annual plans divided by twelve, which is the only way monthly and
 * yearly subscribers can be compared. Lifetime is reported separately — it is
 * cash, not recurring revenue, and folding it in flatters the number.
 */
export function computeAdminTotals(
  users: number,
  subscriptions: SubscriptionSample[],
): AdminTotals {
  let mrrMinor = 0;
  let lifetimeMinor = 0;
  let activeSubs = 0;
  let payingUsers = 0;

  for (const sub of subscriptions) {
    if (!ACTIVE.includes(sub.status)) continue;
    activeSubs += 1;

    if (sub.tier === 'lifetime' || sub.interval === 'once') {
      lifetimeMinor += sub.priceMinor;
      payingUsers += 1;
      continue;
    }

    if (sub.tier === 'free') continue;

    payingUsers += 1;
    mrrMinor += sub.interval === 'year' ? Math.round(sub.priceMinor / 12) : sub.priceMinor;
  }

  return {
    users,
    activeSubs,
    payingUsers,
    mrrMinor,
    lifetimeMinor,
    conversionPct: users === 0 ? null : (payingUsers / users) * 100,
  };
}

/** Signups per day for the last `days` days, zero-filled so gaps show. */
export function bucketByDay(dates: string[], days = 30, now = new Date()): SignupPoint[] {
  const counts = new Map<string, number>();

  for (const value of dates) {
    const key = value.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: SignupPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    out.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return out;
}

export interface PaymentSample {
  createdAt: string;
  amountMinor: number;
  currency: string;
  status: string;
}

/** Paid revenue per month, newest last. Refunds and failures are excluded. */
export function bucketRevenue(payments: PaymentSample[]): RevenuePoint[] {
  const months = new Map<string, { minor: number; currency: string }>();

  for (const payment of payments) {
    if (payment.status !== 'paid') continue;
    const month = payment.createdAt.slice(0, 7);
    const existing = months.get(month) ?? { minor: 0, currency: payment.currency };
    existing.minor += payment.amountMinor;
    months.set(month, existing);
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, minor: value.minor, currency: value.currency }));
}
