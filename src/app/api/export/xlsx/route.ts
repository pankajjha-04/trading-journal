import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAccounts, getTrades } from '@/lib/data/trades';
import { safeFilename } from '@/lib/export/csv';
import { computeTradeResult, computePortfolioStats, breakdownBy } from '@/lib/metrics';

/**
 * Three sheets rather than one: raw trades for a pivot table, a summary for
 * whoever asked for "the numbers", and the setup breakdown, which is the sheet
 * people actually paste into a message.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const accountId = request.nextUrl.searchParams.get('account');
  const accounts = await getAccounts(user.id);
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  if (!account) return NextResponse.json({ error: 'No account to export' }, { status: 404 });

  const trades = await getTrades(user.id, account.id);
  const stats = computePortfolioStats(trades, account.startingBalance);

  // Loaded here rather than at module scope: this route is the only thing in
  // the app that needs SheetJS on the server.
  const XLSX = await import('xlsx');

  const tradeRows = trades.map((trade) => {
    const r = computeTradeResult(trade);
    const closed = trade.status === 'closed';
    return {
      Symbol: trade.symbol,
      Direction: trade.direction,
      Status: trade.status,
      'Opened At': trade.openedAt,
      'Closed At': trade.closedAt ?? '',
      Quantity: trade.quantity,
      'Contract Size': trade.contractSize,
      'Entry Price': trade.entryPrice,
      'Exit Price': trade.exitPrice ?? '',
      'Stop Loss': trade.stopLoss ?? '',
      'Take Profit': trade.takeProfit ?? '',
      Fees: trade.fees,
      Commission: trade.commission,
      Swap: trade.swap,
      'Net P&L': closed ? Number(r.netPnl.toFixed(2)) : '',
      'R Multiple': closed && r.rMultiple !== null ? Number(r.rMultiple.toFixed(2)) : '',
      'Planned RR': r.plannedRr !== null ? Number(r.plannedRr.toFixed(2)) : '',
      Setup: trade.setup ?? '',
      Timeframe: trade.timeframe ?? '',
      Session: trade.session ?? '',
      Emotion: trade.emotion ?? '',
      Confidence: trade.confidence ?? '',
      'Execution Rating': trade.executionRating ?? '',
      Tags: trade.tags.join('; '),
      Notes: trade.notes ?? '',
    };
  });

  const round = (v: number | null) => (v === null ? '' : Number(v.toFixed(2)));

  const summaryRows = [
    { Metric: 'Account', Value: account.name },
    { Metric: 'Currency', Value: account.currency },
    { Metric: 'Starting balance', Value: account.startingBalance },
    { Metric: 'Closed trades', Value: stats.closedTrades },
    { Metric: 'Open trades', Value: stats.openTrades },
    { Metric: 'Net P&L', Value: round(stats.netPnl) },
    { Metric: 'Win rate %', Value: round(stats.winRate) },
    { Metric: 'Profit factor', Value: round(stats.profitFactor) },
    { Metric: 'Expectancy', Value: round(stats.expectancy) },
    { Metric: 'Average R', Value: round(stats.expectancyR) },
    { Metric: 'Average winner', Value: round(stats.avgWin) },
    { Metric: 'Average loser', Value: round(stats.avgLoss) },
    { Metric: 'Largest win', Value: round(stats.largestWin) },
    { Metric: 'Largest loss', Value: round(stats.largestLoss) },
    { Metric: 'Max drawdown', Value: round(stats.maxDrawdown) },
    { Metric: 'Max drawdown %', Value: round(stats.maxDrawdownPct) },
    { Metric: 'Longest win streak', Value: stats.maxConsecutiveWins },
    { Metric: 'Longest loss streak', Value: stats.maxConsecutiveLosses },
    { Metric: 'Total costs', Value: round(stats.totalCosts) },
    { Metric: 'Exported', Value: new Date().toISOString() },
  ];

  const setupRows = breakdownBy(trades, 'setup', account.startingBalance).map((row) => ({
    Setup: row.label,
    Trades: row.stats.closedTrades,
    'Win rate %': round(row.stats.winRate),
    'Average R': round(row.stats.expectancyR),
    'Net P&L': round(row.stats.netPnl),
    Reliable: row.reliable ? 'yes' : 'too few trades',
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tradeRows), 'Trades');
  if (setupRows.length > 0) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(setupRows), 'By setup');
  }

  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeFilename(account.name, 'xlsx')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
