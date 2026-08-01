'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tradeSchema } from '@/lib/validations/trade';
import type { ActionState } from '@/app/(auth)/actions';
import { echoValues } from '@/lib/forms/echo';
import { countTrades, getMembership } from '@/lib/billing/entitlements';
import { checkTradeLimit } from '@/lib/billing/plans';

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * `datetime-local` submits "2025-01-04T09:30" with no zone. Reading it as UTC
 * would shift every Indian trade back by 5.5 hours and silently move trades
 * into the wrong session bucket. Treating it as local time and converting to
 * an absolute instant is the only correct reading.
 */
function localToIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  ];
}

function readForm(formData: FormData) {
  const status = String(formData.get('status') ?? 'open');

  return {
    accountId: String(formData.get('accountId') ?? ''),
    strategyId: optionalText(formData.get('strategyId')),
    symbol: String(formData.get('symbol') ?? ''),
    market: String(formData.get('market') ?? 'crypto'),
    direction: String(formData.get('direction') ?? 'long'),
    status,
    openedAt: localToIso(formData.get('openedAt')) ?? '',
    // An open trade must not carry a close time, even if the field had a
    // leftover value from before the user switched status.
    closedAt: status === 'closed' ? localToIso(formData.get('closedAt')) : null,
    quantity: formData.get('quantity'),
    contractSize: formData.get('contractSize') || 1,
    entryPrice: formData.get('entryPrice'),
    exitPrice: status === 'closed' ? optionalNumber(formData.get('exitPrice')) : null,
    stopLoss: optionalNumber(formData.get('stopLoss')),
    takeProfit: optionalNumber(formData.get('takeProfit')),
    fees: formData.get('fees') || 0,
    commission: formData.get('commission') || 0,
    swap: formData.get('swap') || 0,
    setup: optionalText(formData.get('setup')),
    timeframe: optionalText(formData.get('timeframe')),
    session: optionalText(formData.get('session')),
    marketCondition: optionalText(formData.get('marketCondition')),
    emotion: optionalText(formData.get('emotion')),
    confidence: optionalNumber(formData.get('confidence')),
    executionRating: optionalNumber(formData.get('executionRating')),
    notes: optionalText(formData.get('notes')),
    tags: parseTags(formData.get('tags')),
  };
}

/** Domain shape → database columns. The only place snake_case appears. */
function toRow(data: ReturnType<typeof tradeSchema.parse>, userId: string) {
  return {
    user_id: userId,
    account_id: data.accountId,
    strategy_id: data.strategyId,
    symbol: data.symbol,
    market: data.market,
    direction: data.direction,
    status: data.status,
    opened_at: data.openedAt,
    closed_at: data.closedAt,
    quantity: data.quantity,
    contract_size: data.contractSize,
    entry_price: data.entryPrice,
    exit_price: data.exitPrice,
    stop_loss: data.stopLoss,
    take_profit: data.takeProfit,
    fees: data.fees,
    commission: data.commission,
    swap: data.swap,
    setup: data.setup,
    timeframe: data.timeframe,
    session: data.session,
    market_condition: data.marketCondition,
    emotion: data.emotion,
    confidence: data.confidence,
    execution_rating: data.executionRating,
    notes: data.notes,
    tags: data.tags,
  };
}

export async function createTrade(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = tradeSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Checked at the write, not in the UI. A disabled button is a suggestion.
  const [membership, count] = await Promise.all([
    getMembership(user.id),
    countTrades(user.id),
  ]);
  const limit = checkTradeLimit(membership.entitlements, count);

  if (!limit.allowed) {
    return { error: `${limit.reason} Upgrade in Settings to keep logging.` };
  }

  const { error } = await supabase.from('trades').insert(toRow(parsed.data, user.id));

  if (error) {
    console.error('[trade:create]', error.code, error.message);
    // 42501 is raised by assert_owned_account when the account belongs to
    // someone else — a real authorization failure, not a form mistake.
    if (error.code === '42501') {
      return { error: 'That account does not belong to you.', values: echoValues(formData, []), stamp: Date.now() };
    }
    return { error: 'We could not save that trade. Check the values and try again.', values: echoValues(formData, []), stamp: Date.now() };
  }

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  redirect(`/journal?account=${parsed.data.accountId}`);
}

export async function updateTrade(
  tradeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = tradeSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The user_id filter is belt and braces: RLS already scopes the update, but
  // an explicit predicate means a policy regression cannot widen this write.
  const { error } = await supabase
    .from('trades')
    .update(toRow(parsed.data, user.id))
    .eq('id', tradeId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[trade:update]', error.code, error.message);
    return { error: 'We could not update that trade.', values: echoValues(formData, []), stamp: Date.now() };
  }

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  redirect(`/journal?account=${parsed.data.accountId}`);
}

export async function deleteTrade(tradeId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[trade:delete]', error.code, error.message);
  }

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  redirect('/journal');
}
