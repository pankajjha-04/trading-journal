'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTrade } from '@/lib/data/trades';
import { breakdownBy, computePortfolioStats } from '@/lib/metrics';
import { toTrade } from '@/lib/data/trades';
import { AiError, getProvider } from '@/lib/ai/provider';
import {
  TRADE_REVIEW_SYSTEM,
  buildTradeReviewPrompt,
  parseReview,
  reviewInputHash,
  type TradeReview,
} from '@/lib/ai/review';

export interface ReviewState {
  review?: TradeReview;
  cached?: boolean;
  error?: string;
}

/** Per-user ceiling. Inference is cheap; an unbounded loop of it is not. */
const DAILY_LIMIT = 40;

export async function reviewTrade(tradeId: string): Promise<ReviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const trade = await getTrade(user.id, tradeId);
  if (!trade) return { error: 'That trade was not found.' };

  if (trade.status !== 'closed') {
    return { error: 'Reviews are for finished trades. Close this one first.' };
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('currency, starting_balance')
    .eq('id', trade.accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const currency = account?.currency ?? 'USD';

  // The review is only worth reading with the trader's own history attached,
  // so it is fetched even though it costs an extra query.
  const { data: rows } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', trade.accountId)
    .limit(5000);

  const all = (rows ?? []).map(toTrade);
  const balance = Number(account?.starting_balance ?? 0);
  const accountStats = computePortfolioStats(all, balance);
  const setupStats = trade.setup
    ? (breakdownBy(all, 'setup', balance).find((row) => row.key === trade.setup)?.stats ?? null)
    : null;

  const prompt = buildTradeReviewPrompt(trade, currency, { setupStats, accountStats });

  let provider;
  try {
    provider = getProvider();
  } catch (error) {
    return {
      error:
        error instanceof AiError && error.kind === 'config'
          ? 'AI review is not configured on this server yet.'
          : 'AI review is unavailable.',
    };
  }

  const hash = reviewInputHash(prompt, provider.model);

  const { data: existing } = await supabase
    .from('ai_reviews')
    .select('summary, findings, scores')
    .eq('user_id', user.id)
    .eq('scope', 'trade')
    .eq('input_hash', hash)
    .maybeSingle();

  if (existing) {
    return {
      cached: true,
      review: {
        summary: existing.summary,
        findings: existing.findings ?? [],
        scores: existing.scores,
      },
    };
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase
    .from('ai_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  if ((count ?? 0) >= DAILY_LIMIT) {
    return { error: `You have used all ${DAILY_LIMIT} reviews for today. They reset in 24 hours.` };
  }

  let response;
  try {
    response = await provider.complete({
      system: TRADE_REVIEW_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
    });
  } catch (error) {
    if (error instanceof AiError) {
      const message: Record<string, string> = {
        rate_limit: 'The model provider is rate limiting us. Try again in a minute.',
        config: 'AI review is not configured correctly on this server.',
        network: 'Could not reach the model. Try again.',
        refused: 'The model declined to review that trade.',
        unknown: 'The review failed. Try again.',
      };
      return { error: message[error.kind] ?? message.unknown };
    }
    return { error: 'The review failed. Try again.' };
  }

  if (!response.text.trim()) {
    console.error('[ai:review] empty completion from', provider.id, provider.model);
    return { error: 'The model returned nothing. Try again.' };
  }

  const review = parseReview(response.text);

  // A malformed response is discarded rather than shown. Half a review, or a
  // score the schema rejected, is worse than telling the user it failed.
  if (!review) {
    console.error('[ai:review] unparseable response', response.text.slice(0, 200));
    return { error: 'The model returned something we could not read. Try again.' };
  }

  await supabase.from('ai_reviews').insert({
    user_id: user.id,
    trade_id: trade.id,
    scope: 'trade',
    model: `${provider.id}:${provider.model}`,
    input_hash: hash,
    summary: review.summary,
    findings: review.findings,
    scores: review.scores,
    token_cost: response.inputTokens + response.outputTokens,
  });

  revalidatePath(`/journal/${trade.id}/edit`);
  return { review };
}
