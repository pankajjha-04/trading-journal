export type PlanTier = 'free' | 'pro' | 'lifetime';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export interface Entitlements {
  tier: PlanTier;
  /** Null means unlimited. */
  tradeLimit: number | null;
  accountLimit: number | null;
  aiCredits: number;
  canImport: boolean;
  canExport: boolean;
}

export const FREE: Entitlements = {
  tier: 'free',
  tradeLimit: 50,
  accountLimit: 1,
  aiCredits: 0,
  // Export is never gated. A journal that holds your data hostage is not a
  // journal, and the landing page promises the opposite.
  canImport: true,
  canExport: true,
};

const PRO: Entitlements = {
  tier: 'pro',
  tradeLimit: null,
  accountLimit: null,
  aiCredits: 200,
  canImport: true,
  canExport: true,
};

const LIFETIME: Entitlements = { ...PRO, tier: 'lifetime', aiCredits: 5000 };

/**
 * Which statuses still grant access.
 *
 * `past_due` deliberately keeps working: a card that failed on renewal is
 * usually a bank decline, not a decision to leave, and locking someone out of
 * their own trade history over it is a good way to never get paid.
 */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due'];

export function entitlementsFor(
  tier: PlanTier | null | undefined,
  status: SubscriptionStatus | null | undefined,
): Entitlements {
  if (!tier || tier === 'free') return FREE;
  // A lifetime purchase has no renewal, so status is irrelevant to it.
  if (tier === 'lifetime') return LIFETIME;
  if (!status || !ACTIVE_STATUSES.includes(status)) return FREE;
  return PRO;
}

export interface LimitCheck {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  reason?: string;
}

export function checkTradeLimit(
  entitlements: Entitlements,
  currentCount: number,
  adding = 1,
): LimitCheck {
  const limit = entitlements.tradeLimit;
  if (limit === null) {
    return { allowed: true, limit: null, used: currentCount, remaining: null };
  }

  const remaining = Math.max(0, limit - currentCount);
  if (currentCount + adding <= limit) {
    return { allowed: true, limit, used: currentCount, remaining: remaining - adding };
  }

  return {
    allowed: false,
    limit,
    used: currentCount,
    remaining,
    reason:
      adding === 1
        ? `The free plan holds ${limit} trades. You have ${currentCount}.`
        : `That import needs ${adding} slots and ${remaining} are left on the free plan.`,
  };
}

export function checkAccountLimit(
  entitlements: Entitlements,
  currentCount: number,
): LimitCheck {
  const limit = entitlements.accountLimit;
  if (limit === null) {
    return { allowed: true, limit: null, used: currentCount, remaining: null };
  }

  const allowed = currentCount < limit;
  return {
    allowed,
    limit,
    used: currentCount,
    remaining: Math.max(0, limit - currentCount),
    reason: allowed
      ? undefined
      : `The free plan allows ${limit} ${limit === 1 ? 'account' : 'accounts'}.`,
  };
}

/** Percentage used, for the nudge that appears before the wall does. */
export function usageRatio(check: LimitCheck): number | null {
  if (check.limit === null || check.limit === 0) return null;
  return Math.min(1, check.used / check.limit);
}
