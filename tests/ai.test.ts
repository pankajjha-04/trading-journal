import { describe, expect, it } from 'vitest';
import {
  buildTradeReviewPrompt,
  parseReview,
  reviewInputHash,
} from '@/lib/ai/review';
import type { Trade } from '@/lib/types/trade';

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1', accountId: 'a', symbol: 'BTCUSDT', market: 'crypto',
    direction: 'long', status: 'closed',
    openedAt: '2026-01-04T09:00:00.000Z', closedAt: '2026-01-04T11:00:00.000Z',
    quantity: 1, contractSize: 1, entryPrice: 100, exitPrice: 110,
    stopLoss: 90, takeProfit: 130, fees: 0, commission: 0, swap: 0,
    strategyId: null, setup: 'Order block', timeframe: '15m', session: 'london',
    marketCondition: null, emotion: 'calm', confidence: 7,
    executionRating: 8, notes: 'Waited for the retest', tags: [], ...overrides,
  };
}

const VALID = {
  summary: 'Stop was placed correctly and the plan was followed.',
  findings: [{ kind: 'strength', text: 'Stop set before entry' }],
  scores: { execution: 8, risk: 7, discipline: 8 },
};

describe('parseReview', () => {
  it('accepts clean JSON', () => {
    expect(parseReview(JSON.stringify(VALID))?.scores.execution).toBe(8);
  });

  it('unwraps a markdown fence', () => {
    const fenced = '```json\n' + JSON.stringify(VALID) + '\n```';
    expect(parseReview(fenced)?.summary).toBe(VALID.summary);
  });

  it('ignores prose the model adds before or after', () => {
    const noisy = `Sure! Here is the review:\n${JSON.stringify(VALID)}\nHope that helps.`;
    expect(parseReview(noisy)).not.toBeNull();
  });

  it('rejects a score outside the range instead of clamping it', () => {
    const bad = { ...VALID, scores: { execution: 47, risk: 7, discipline: 8 } };
    expect(parseReview(JSON.stringify(bad))).toBeNull();
  });

  it('rejects an unknown finding kind', () => {
    const bad = { ...VALID, findings: [{ kind: 'advice', text: 'Buy more' }] };
    expect(parseReview(JSON.stringify(bad))).toBeNull();
  });

  it('rejects a missing scores block', () => {
    expect(parseReview(JSON.stringify({ summary: 'x', findings: [] }))).toBeNull();
  });

  it('returns null for empty, prose-only, or broken output', () => {
    expect(parseReview('')).toBeNull();
    expect(parseReview('I cannot help with that.')).toBeNull();
    expect(parseReview('{ "summary": ')).toBeNull();
  });

  it('caps findings so one runaway response cannot flood the UI', () => {
    const many = {
      ...VALID,
      findings: Array.from({ length: 20 }, () => ({ kind: 'note', text: 'x' })),
    };
    expect(parseReview(JSON.stringify(many))).toBeNull();
  });
});

describe('buildTradeReviewPrompt', () => {
  it('states plainly when a stop was never set, rather than omitting it', () => {
    const prompt = buildTradeReviewPrompt(trade({ stopLoss: null }), 'USD');
    expect(prompt).toContain('Stop loss: NOT SET');
    expect(prompt).toContain('cannot be computed, no stop was set');
  });

  it('includes the computed result, not just the raw prices', () => {
    const prompt = buildTradeReviewPrompt(trade(), 'USD');
    expect(prompt).toContain('Result in R: 1.00');
    expect(prompt).toContain('Planned reward to risk: 3.00');
  });

  it('marks untagged fields as untagged so the model does not invent them', () => {
    const prompt = buildTradeReviewPrompt(
      trade({ setup: null, emotion: null, notes: null }),
      'USD',
    );
    expect(prompt).toContain('Setup: not tagged');
    expect(prompt).toContain('Emotion going in: not recorded');
    expect(prompt).toContain('Notes: none written');
  });

  it('warns when the setup history is too small to trust', () => {
    const prompt = buildTradeReviewPrompt(trade(), 'USD', {
      setupStats: {
        closedTrades: 4, winRate: 75, expectancyR: 0.8, netPnl: 400,
      } as never,
    });
    expect(prompt).toContain('not yet reliable');
  });

  it('omits the history section entirely when there is none', () => {
    const prompt = buildTradeReviewPrompt(trade(), 'USD', { setupStats: null });
    expect(prompt).not.toContain("THIS TRADER'S RECORD");
  });
});

describe('reviewInputHash', () => {
  it('is stable for identical input', () => {
    const a = buildTradeReviewPrompt(trade(), 'USD');
    expect(reviewInputHash(a, 'm')).toBe(reviewInputHash(a, 'm'));
  });

  it('changes when the trade changes', () => {
    const a = buildTradeReviewPrompt(trade(), 'USD');
    const b = buildTradeReviewPrompt(trade({ notes: 'Chased it' }), 'USD');
    expect(reviewInputHash(a, 'm')).not.toBe(reviewInputHash(b, 'm'));
  });

  it('changes when the model changes, so a cache is never served across models', () => {
    const a = buildTradeReviewPrompt(trade(), 'USD');
    expect(reviewInputHash(a, 'gemini')).not.toBe(reviewInputHash(a, 'claude'));
  });
});
