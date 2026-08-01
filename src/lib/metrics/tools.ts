/**
 * Position sizing, done the only way that is safe: risk first, size second.
 * A trader who picks the size and then places the stop is choosing how much
 * to lose by accident.
 */

export interface SizingInput {
  balance: number;
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  contractSize: number;
}

export interface SizingResult {
  riskAmount: number;
  stopDistance: number;
  /** Units, lots or contracts, depending on the instrument. */
  quantity: number | null;
  notional: number | null;
  /** How much of the balance the position controls, as a multiple. */
  leverage: number | null;
  reason?: string;
}

export function computePositionSize(input: SizingInput): SizingResult {
  const { balance, riskPercent, entryPrice, stopPrice, contractSize } = input;
  const riskAmount = (balance * riskPercent) / 100;
  const stopDistance = Math.abs(entryPrice - stopPrice);

  if (balance <= 0) {
    return { riskAmount: 0, stopDistance, quantity: null, notional: null, leverage: null, reason: 'Enter your account balance.' };
  }
  if (riskPercent <= 0) {
    return { riskAmount, stopDistance, quantity: null, notional: null, leverage: null, reason: 'Set the risk above zero.' };
  }
  if (stopDistance === 0) {
    // Dividing by a zero stop yields Infinity, which renders as a position
    // size that would liquidate the account.
    return { riskAmount, stopDistance, quantity: null, notional: null, leverage: null, reason: 'Entry and stop cannot be the same price.' };
  }
  if (entryPrice <= 0 || contractSize <= 0) {
    return { riskAmount, stopDistance, quantity: null, notional: null, leverage: null, reason: 'Enter a price and contract size above zero.' };
  }

  const quantity = riskAmount / (stopDistance * contractSize);
  const notional = quantity * entryPrice * contractSize;

  return {
    riskAmount,
    stopDistance,
    quantity,
    notional,
    leverage: notional / balance,
  };
}

export interface RewardInput {
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
}

export interface RewardResult {
  risk: number;
  reward: number;
  ratio: number | null;
  /** Win rate needed to break even at this ratio, as a percentage. */
  breakevenWinRate: number | null;
}

export function computeReward(input: RewardInput): RewardResult {
  const risk = Math.abs(input.entryPrice - input.stopPrice);
  const reward = Math.abs(input.targetPrice - input.entryPrice);

  if (risk === 0) return { risk, reward, ratio: null, breakevenWinRate: null };

  const ratio = reward / risk;
  // The number that actually matters: at 2R you only need to be right a third
  // of the time, which is why win rate on its own says nothing.
  const breakevenWinRate = (1 / (1 + ratio)) * 100;

  return { risk, reward, ratio, breakevenWinRate };
}

/** A JPY pair quotes to three decimals, so its pip is a tenth of the others'. */
export function pipSize(symbol: string): number {
  return symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001;
}

export interface PipInput {
  symbol: string;
  lots: number;
  /** Units per standard lot. 100,000 for spot forex. */
  contractSize: number;
  /** Quote currency per unit of account currency. 1 when they match. */
  quoteRate: number;
}

export function computePipValue(input: PipInput): number {
  return pipSize(input.symbol) * input.lots * input.contractSize * input.quoteRate;
}

export interface StreakInput {
  /** ISO dates on which the habit was kept, in any order. */
  dates: string[];
  today?: Date;
}

export interface StreakResult {
  current: number;
  longest: number;
  total: number;
}

/**
 * Counts consecutive days back from today. A gap yesterday still counts if
 * today is kept — the streak is only broken once a whole day passes with
 * nothing recorded and today is empty too.
 */
export function computeStreak({ dates, today = new Date() }: StreakInput): StreakResult {
  const unique = [...new Set(dates.map((date) => date.slice(0, 10)))].sort();
  if (unique.length === 0) return { current: 0, longest: 0, total: 0 };

  const day = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const kept = new Set(unique);

  let current = 0;
  // Yesterday is the start point when today is not yet recorded, so an
  // unbroken habit does not read as zero every morning.
  let cursor = kept.has(day(0)) ? 0 : kept.has(day(1)) ? 1 : -1;
  if (cursor >= 0) {
    while (kept.has(day(cursor))) {
      current += 1;
      cursor += 1;
    }
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of unique) {
    if (previous !== null) {
      const gap =
        (new Date(`${date}T00:00:00Z`).getTime() -
          new Date(`${previous}T00:00:00Z`).getTime()) /
        86_400_000;
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = date;
  }

  return { current, longest, total: unique.length };
}
