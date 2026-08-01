'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { countTrades, getMembership } from '@/lib/billing/entitlements';
import { checkTradeLimit } from '@/lib/billing/plans';
import { tradeSchema } from '@/lib/validations/trade';
import type { Database } from '@/lib/types/database';

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: ImportRowError[];
  message?: string;
}

/** Server-side ceiling. The browser holds the file; the database should not. */
const MAX_ROWS = 2000;

export async function importTrades(
  accountId: string,
  payload: string,
): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: 'That file could not be read.' };
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: 'No rows to import.' };
  }
  if (raw.length > MAX_ROWS) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      errors: [],
      message: `That file has ${raw.length} rows. Split it into files of ${MAX_ROWS} or fewer.`,
    };
  }

  // The whole batch is checked at once, so a free-plan import either fits or
  // is refused — half an import is worse than none.
  const [membership, existing] = await Promise.all([
    getMembership(user.id),
    countTrades(user.id),
  ]);
  const limit = checkTradeLimit(membership.entitlements, existing, raw.length);

  if (!limit.allowed) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: limit.reason };
  }

  // The account is re-checked here rather than trusted from the form, so a
  // tampered request cannot write into somebody else's account.
  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account) {
    return { ok: false, imported: 0, skipped: 0, errors: [], message: 'That account was not found.' };
  }

  type TradeInsert = Database['public']['Tables']['trades']['Insert'];

  const errors: ImportRowError[] = [];
  const rows: TradeInsert[] = [];

  raw.forEach((entry, index) => {
    const values = entry as Record<string, unknown>;
    const parsed = tradeSchema.safeParse({ ...values, accountId, tags: [] });

    if (!parsed.success) {
      // One error per row keeps the report readable; the first failure is
      // almost always the one that needs fixing in the source file.
      const issue = parsed.error.issues[0];
      errors.push({
        row: index + 1,
        field: String(issue?.path[0] ?? 'row'),
        message: issue?.message ?? 'Could not be read',
      });
      return;
    }

    const d = parsed.data;
    rows.push({
      user_id: user.id,
      account_id: accountId,
      symbol: d.symbol,
      market: d.market,
      direction: d.direction,
      status: d.status,
      opened_at: d.openedAt,
      closed_at: d.closedAt,
      quantity: d.quantity,
      contract_size: d.contractSize,
      entry_price: d.entryPrice,
      exit_price: d.exitPrice,
      stop_loss: d.stopLoss,
      take_profit: d.takeProfit,
      fees: d.fees,
      commission: d.commission,
      swap: d.swap,
      setup: d.setup,
      timeframe: d.timeframe,
      notes: d.notes,
      tags: [],
      external_id: typeof values.externalId === 'string' ? values.externalId : null,
    });
  });

  if (rows.length === 0) {
    return {
      ok: false,
      imported: 0,
      skipped: errors.length,
      errors: errors.slice(0, 50),
      message: 'No rows could be imported. Check the mapping and try again.',
    };
  }

  const { data: batch } = await supabase
    .from('import_batches')
    .insert({
      user_id: user.id,
      account_id: accountId,
      source: 'csv',
      row_count: raw.length,
      imported: 0,
      skipped: errors.length,
      errors: errors.slice(0, 50),
    })
    .select('id')
    .maybeSingle();

  const withBatch = rows.map((row) => ({ ...row, import_batch_id: batch?.id ?? null }));

  // Rows carrying an order id go through upsert so re-importing the same
  // export does not duplicate them; the unique index does the work.
  const withId = withBatch.filter((r) => r.external_id !== null);
  const withoutId = withBatch.filter((r) => r.external_id === null);

  let imported = 0;

  if (withId.length > 0) {
    const { data, error } = await supabase
      .from('trades')
      .upsert(withId, { onConflict: 'account_id,external_id', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('[import:upsert]', error.code, error.message);
      return {
        ok: false,
        imported: 0,
        skipped: raw.length,
        errors: errors.slice(0, 50),
        message: 'The import failed while saving. Nothing was changed.',
      };
    }
    imported += data?.length ?? 0;
  }

  if (withoutId.length > 0) {
    const { data, error } = await supabase.from('trades').insert(withoutId).select('id');
    if (error) {
      console.error('[import:insert]', error.code, error.message);
      return {
        ok: false,
        imported,
        skipped: raw.length - imported,
        errors: errors.slice(0, 50),
        message: 'Some rows saved before the import failed. Check the journal.',
      };
    }
    imported += data?.length ?? 0;
  }

  if (batch?.id) {
    await supabase
      .from('import_batches')
      .update({ imported, skipped: raw.length - imported })
      .eq('id', batch.id);
  }

  revalidatePath('/journal');
  revalidatePath('/dashboard');
  revalidatePath('/analytics');

  return {
    ok: true,
    imported,
    skipped: raw.length - imported,
    errors: errors.slice(0, 50),
  };
}
