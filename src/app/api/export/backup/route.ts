import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeFilename } from '@/lib/export/csv';

/**
 * Everything the user owns, in one JSON file. This is the promise the landing
 * page makes — "export everything, always" — so it includes tables the UI
 * does not surface yet rather than only what is currently visible.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const [profile, accounts, strategies, trades, journal, goals] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('accounts').select('*').eq('user_id', user.id),
    supabase.from('strategies').select('*').eq('user_id', user.id),
    supabase.from('trades').select('*').eq('user_id', user.id).limit(20_000),
    supabase.from('journal_entries').select('*').eq('user_id', user.id),
    supabase.from('goals').select('*').eq('user_id', user.id),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    profile: profile.data ?? null,
    accounts: accounts.data ?? [],
    strategies: strategies.data ?? [],
    trades: trades.data ?? [],
    journalEntries: journal.data ?? [],
    goals: goals.data ?? [],
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename('ledgerline-backup', 'json')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
