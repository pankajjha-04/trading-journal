/**
 * Every number rendered in the product goes through here.
 * Inconsistent formatting is the fastest way to make a finance UI feel cheap.
 */

const currencyCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, locale: string, fractionDigits: number) {
  const key = `${currency}:${locale}:${fractionDigits}`;
  let fmt = currencyCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    currencyCache.set(key, fmt);
  }
  return fmt;
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  options: { locale?: string; compact?: boolean; signed?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const locale = options.locale ?? (currency === 'INR' ? 'en-IN' : 'en-US');

  if (options.compact && Math.abs(value) >= 10_000) {
    const compact = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    return options.signed && value > 0 ? `+${compact}` : compact;
  }

  const formatted = currencyFormatter(currency, locale, 2).format(value);
  return options.signed && value > 0 ? `+${formatted}` : formatted;
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
  signed = false,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const formatted = `${value.toFixed(digits)}%`;
  return signed && value > 0 ? `+${formatted}` : formatted;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatR(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`;
}

/** Tone for P&L colouring. Null and zero are deliberately neutral. */
export function pnlTone(value: number | null | undefined): 'gain' | 'loss' | 'flat' {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return 'flat';
  }
  return value > 0 ? 'gain' : 'loss';
}
