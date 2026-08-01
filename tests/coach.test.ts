import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  buildAccountContext,
  coachInputHash,
  parseCoachAnswer,
} from '@/lib/ai/coach';
import type { Trade } from '@/lib/types/trade';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: crypto.randomUUID(), accountId: 'a', symbol: 'XAUUSD', market: 'forex',
    direction: 'long', status: 'closed',
    openedAt: '2026-01-05T09:00:00.000Z', closedAt: '2026-01-05T11:00:00.000Z',
    quantity: 1, contractSize: 1, entryPrice: 100, exitPrice: 110,
    stopLoss: 90, takeProfit: 130, fees: 0, commission: 0, swap: 0,
    strategyId: null, setup: 'Order block', timeframe: '15m', session: 'london',
    marketCondition: null, emotion: 'calm', confidence: 7,
    executionRating: 8, notes: null, tags: [], ...overrides,
  };
}

const VALID = {
  summary: 'Your losses cluster on Fridays.',
  points: [{ title: 'Friday drag', detail: 'Fridays are net negative across 22 trades.' }],
  nextSteps: ['Review the Friday trades before adding size'],
};

describe('presets', () => {
  it('never asks the model to predict or recommend a trade', () => {
    const banned = /predict|should i buy|should i sell|forecast|price target|what will/i;
    for (const preset of PRESETS) {
      expect(banned.test(preset.question), preset.id).toBe(false);
    }
  });

  it('has unique ids and states what each one needs', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of PRESETS) {
      expect(['none', 'image', 'document']).toContain(preset.needs);
    }
  });
});

describe('parseCoachAnswer', () => {
  it('accepts a well-formed answer', () => {
    expect(parseCoachAnswer(JSON.stringify(VALID))?.points).toHaveLength(1);
  });

  it('unwraps fences and ignores surrounding prose', () => {
    expect(parseCoachAnswer('Here you go:\n```json\n' + JSON.stringify(VALID) + '\n```')).not.toBeNull();
  });

  it('rejects an answer with no points', () => {
    expect(parseCoachAnswer(JSON.stringify({ ...VALID, points: [] }))).toBeNull();
  });

  it('rejects a runaway list of next steps', () => {
    const bad = { ...VALID, nextSteps: Array.from({ length: 12 }, () => 'x') };
    expect(parseCoachAnswer(JSON.stringify(bad))).toBeNull();
  });

  it('returns null on prose-only or broken output', () => {
    expect(parseCoachAnswer('I cannot answer that.')).toBeNull();
    expect(parseCoachAnswer('')).toBeNull();
  });
});

describe('buildAccountContext', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    trade({ closedAt: `2026-01-${String(i + 5).padStart(2, '0')}T11:00:00.000Z` }),
  );

  it('says so plainly when there is nothing logged', () => {
    expect(buildAccountContext([], 'USD', 1000)).toContain('no closed trades');
  });

  it('includes the headline numbers a question would need', () => {
    const context = buildAccountContext(many, 'USD', 10_000);
    expect(context).toContain('Closed trades: 12');
    expect(context).toContain('Win rate');
    expect(context).toContain('Max drawdown');
  });

  it('counts trades that had no stop, since that is the common failure', () => {
    const context = buildAccountContext(
      [...many, trade({ stopLoss: null })],
      'USD',
      10_000,
    );
    expect(context).toContain('Closed trades with no stop recorded: 1');
  });

  it('marks small groups so the model cannot conclude from them', () => {
    const context = buildAccountContext(
      [...many, trade({ setup: 'Breaker' })],
      'USD',
      10_000,
    );
    expect(context).toContain('[sample too small]');
  });

  it('leaves individual trades out — only aggregates go in', () => {
    const context = buildAccountContext(many, 'USD', 10_000);
    expect(context).not.toContain('2026-01-05T09:00');
  });
});

describe('coachInputHash', () => {
  it('separates two different attachments with the same question', () => {
    expect(coachInputHash(['m', 'q', 'imageA'])).not.toBe(coachInputHash(['m', 'q', 'imageB']));
  });

  it('is stable for the same inputs', () => {
    expect(coachInputHash(['m', 'q', 'a'])).toBe(coachInputHash(['m', 'q', 'a']));
  });
});

describe('buildBriefContext', () => {
  it('stays short so an attached file is not buried', async () => {
    const { buildBriefContext } = await import('@/lib/ai/coach');
    const many = Array.from({ length: 30 }, () => trade());
    const brief = buildBriefContext(many, 'USD', 10_000);
    const full = buildAccountContext(many, 'USD', 10_000);

    expect(brief.length).toBeLessThan(full.length / 3);
    expect(brief).toContain('context only');
  });

  it('still carries what a position size can be judged against', async () => {
    const { buildBriefContext } = await import('@/lib/ai/coach');
    const brief = buildBriefContext([trade({ exitPrice: 90 })], 'USD', 10_000);
    expect(brief).toContain('Typical loss');
    expect(brief).toContain('without a stop');
  });

  it('says so when nothing is logged yet', async () => {
    const { buildBriefContext } = await import('@/lib/ai/coach');
    expect(buildBriefContext([], 'USD', 5000)).toContain('No closed trades logged yet');
  });
});
