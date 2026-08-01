import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  ACTIVE_STATUSES,
  entitlementsFor,
  type Entitlements,
  type PlanTier,
  type SubscriptionStatus,
} from './plans';

export interface Membership {
  entitlements: Entitlements;
  planId: string | null;
  planName: string;
  status: SubscriptionStatus | null;
  periodEnd: string | null;
  isActive: boolean;
}

/** Single source of truth for what a user is allowed to do. */
export async function getMembership(userId: string): Promise<Membership> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('plan_id, status, current_period_end, plans(name, tier)')
    .eq('user_id', userId)
    .maybeSingle();

  const plan = (data as unknown as { plans?: { name: string; tier: PlanTier } } | null)?.plans;
  const status = (data?.status ?? null) as SubscriptionStatus | null;

  // A period that has already ended counts as expired even if no cancellation
  // webhook ever arrived — a missed webhook must not grant free access forever.
  const expired =
    data?.current_period_end !== null &&
    data?.current_period_end !== undefined &&
    new Date(data.current_period_end).getTime() < Date.now();

  const effective: SubscriptionStatus | null = expired ? 'expired' : status;

  return {
    entitlements: entitlementsFor(plan?.tier ?? null, effective),
    planId: data?.plan_id ?? null,
    planName: plan?.name ?? 'Free',
    status: effective,
    periodEnd: data?.current_period_end ?? null,
    isActive: Boolean(effective && ACTIVE_STATUSES.includes(effective)),
  };
}

export async function countTrades(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

export async function countAccounts(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', false);
  return count ?? 0;
}
