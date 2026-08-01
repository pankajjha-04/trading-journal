'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, toTrade } from '@/lib/data/trades';
import { AiError, getProvider, type AttachmentType } from '@/lib/ai/provider';
import {
  ATTACHMENT_SYSTEM,
  COACH_SYSTEM,
  PRESETS,
  buildAccountContext,
  buildBriefContext,
  coachInputHash,
  parseCoachAnswer,
  type CoachAnswer,
} from '@/lib/ai/coach';

export interface CoachState {
  answer?: CoachAnswer;
  cached?: boolean;
  error?: string;
}

const DAILY_LIMIT = 40;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED: AttachmentType[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

export async function askCoach(input: {
  accountId: string;
  presetId: string;
  question?: string;
  attachment?: { mediaType: string; data: string };
  /** Spreadsheets arrive already flattened to text by the browser. */
  sheet?: { name: string; text: string; rowCount: number; truncated: boolean };
}): Promise<CoachState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accounts = await getAccounts(user.id);
  const account = accounts.find((a) => a.id === input.accountId) ?? accounts[0];
  if (!account) return { error: 'Create an account first.' };

  const preset = PRESETS.find((p) => p.id === input.presetId);
  const question = (preset?.question ?? input.question ?? '').trim();

  if (!question) return { error: 'Pick one of the questions, or type your own.' };
  if (question.length > 500) return { error: 'That question is too long.' };

  let attachment: { mediaType: AttachmentType; data: string } | undefined;
  if (input.attachment) {
    if (!ALLOWED.includes(input.attachment.mediaType as AttachmentType)) {
      return { error: 'Upload a PNG, JPEG, WebP or PDF.' };
    }
    // base64 inflates by about a third; check the decoded size, not the string.
    if ((input.attachment.data.length * 3) / 4 > MAX_ATTACHMENT_BYTES) {
      return { error: 'That file is over 4 MB. Try a smaller one.' };
    }
    attachment = {
      mediaType: input.attachment.mediaType as AttachmentType,
      data: input.attachment.data,
    };
  }

  const { data: rows } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', account.id)
    .limit(5000);

  const trades = (rows ?? []).map(toTrade);

  // When a file is attached it is the subject; the account is background.
  const hasFile = Boolean(input.attachment || input.sheet);
  const context = hasFile
    ? buildBriefContext(trades, account.currency, account.startingBalance)
    : buildAccountContext(trades, account.currency, account.startingBalance);

  let provider;
  try {
    provider = getProvider();
  } catch {
    return { error: 'AI is not configured on this server yet.' };
  }

  // A spreadsheet is text by the time it gets here, so it works everywhere.
  if (attachment && !provider.supportsVision) {
    return {
      error: 'This server is using a text-only model, so files cannot be read.',
    };
  }

  let prompt = `QUESTION\n${question}\n\n`;

  if (input.sheet) {
    const sheet = input.sheet;
    const body = sheet.text.slice(0, 20_000);
    prompt += `UPLOADED SPREADSHEET: ${sheet.name}\n`;
    prompt += `${sheet.rowCount} rows${sheet.truncated ? ', showing the first part only' : ''}\n`;
    prompt += `${body}\n\n`;
  }

  prompt += context;
  // The attachment is part of the identity of the request; without it in the
  // hash a second screenshot would be served the first one's answer.
  const hash = coachInputHash([
    provider.model,
    prompt,
    attachment ? attachment.data.slice(0, 512) : 'no-attachment',
  ]);

  const { data: existing } = await supabase
    .from('ai_reviews')
    .select('summary, findings, scores')
    .eq('user_id', user.id)
    .eq('input_hash', hash)
    .maybeSingle();

  if (existing?.findings) {
    const cached = existing.findings as unknown as CoachAnswer['points'];
    return {
      cached: true,
      answer: {
        summary: existing.summary,
        points: cached,
        nextSteps: (existing.scores as unknown as { nextSteps?: string[] })?.nextSteps ?? [],
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
    return { error: `You have used all ${DAILY_LIMIT} AI requests for today.` };
  }

  let response;
  try {
    response = await provider.complete({
      system: hasFile ? ATTACHMENT_SYSTEM : COACH_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 6144,
      attachment,
    });
  } catch (error) {
    if (error instanceof AiError) {
      const messages: Record<string, string> = {
        rate_limit: 'The model provider is rate limiting us. Try again in a minute.',
        config: 'AI is not configured correctly on this server.',
        network: 'Could not reach the model. Try again.',
        refused: 'The model declined to answer that.',
        unknown: 'That request failed. Try again.',
      };
      return { error: messages[error.kind] ?? messages.unknown };
    }
    return { error: 'That request failed. Try again.' };
  }

  const answer = parseCoachAnswer(response.text);
  if (!answer) {
    console.error('[ai:coach] unparseable', response.text.slice(0, 200));
    return { error: 'The model returned something we could not read. Try again.' };
  }

  await supabase.from('ai_reviews').insert({
    user_id: user.id,
    trade_id: null,
    scope: 'weekly',
    model: `${provider.id}:${provider.model}`,
    input_hash: hash,
    summary: answer.summary,
    findings: answer.points as never,
    scores: { nextSteps: answer.nextSteps } as never,
    token_cost: response.inputTokens + response.outputTokens,
  });

  return { answer };
}
