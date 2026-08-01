import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import { safeFilename, tradesToCsv } from '@/lib/export/csv';

/**
 * Download endpoint rather than a server action: a browser needs a real
 * response with Content-Disposition to save a file, and an action cannot
 * produce one.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get('account');
  const accounts = await getAccounts(user.id);

  // Only an account this user owns — otherwise the query string becomes a way
  // to read someone else's book.
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  if (!account) {
    return NextResponse.json({ error: 'No account to export' }, { status: 404 });
  }

  const trades = await getTrades(user.id, account.id);
  const csv = tradesToCsv(trades);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename(account.name, 'csv')}"`,
      // Exported data is per-user; no shared cache should ever hold it.
      'Cache-Control': 'private, no-store',
    },
  });
}
