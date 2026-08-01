import { computeTradeResult } from '@/lib/metrics';
import type { Trade } from '@/lib/types/trade';

/**
 * Escapes a single field for CSV.
 *
 * The leading-character guard is the important part: a cell starting with
 * =, +, - or @ is executed as a formula when the file is opened in Excel or
 * Sheets. A note reading `=cmd|...` is a real attack, and a symbol column is
 * user-controlled text. Prefixing with a tab neutralises it while keeping the
 * value readable.
 */
export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `\t${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  // CRLF and a BOM so Excel opens UTF-8 symbols correctly on Windows.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const TRADE_EXPORT_HEADERS = [
  'Trade ID',
  'Symbol',
  'Market',
  'Direction',
  'Status',
  'Opened At',
  'Closed At',
  'Quantity',
  'Contract Size',
  'Entry Price',
  'Exit Price',
  'Stop Loss',
  'Take Profit',
  'Fees',
  'Commission',
  'Swap',
  'Gross P&L',
  'Net P&L',
  'R Multiple',
  'Planned RR',
  'Return %',
  'Setup',
  'Timeframe',
  'Session',
  'Market Condition',
  'Emotion',
  'Confidence',
  'Execution Rating',
  'Tags',
  'Notes',
];

/**
 * Round-trippable: every field the import understands is present, so an
 * export can be re-imported without losing anything. Derived columns are
 * included for spreadsheet users and ignored on the way back in.
 */
export function tradesToCsv(trades: Trade[]): string {
  const rows = trades.map((trade) => {
    const r = computeTradeResult(trade);
    const closed = trade.status === 'closed';

    return [
      trade.id,
      trade.symbol,
      trade.market,
      trade.direction,
      trade.status,
      trade.openedAt,
      trade.closedAt ?? '',
      trade.quantity,
      trade.contractSize,
      trade.entryPrice,
      trade.exitPrice ?? '',
      trade.stopLoss ?? '',
      trade.takeProfit ?? '',
      trade.fees,
      trade.commission,
      trade.swap,
      closed ? r.grossPnl.toFixed(8) : '',
      closed ? r.netPnl.toFixed(8) : '',
      closed && r.rMultiple !== null ? r.rMultiple.toFixed(4) : '',
      r.plannedRr !== null ? r.plannedRr.toFixed(4) : '',
      closed ? r.returnPct.toFixed(4) : '',
      trade.setup ?? '',
      trade.timeframe ?? '',
      trade.session ?? '',
      trade.marketCondition ?? '',
      trade.emotion ?? '',
      trade.confidence ?? '',
      trade.executionRating ?? '',
      trade.tags.join('; '),
      trade.notes ?? '',
    ];
  });

  return toCsv(TRADE_EXPORT_HEADERS, rows);
}

/** Filenames end up in Content-Disposition, so keep them boring and safe. */
export function safeFilename(base: string, extension: string): string {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${cleaned || 'export'}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
