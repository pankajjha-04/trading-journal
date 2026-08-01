import { z } from 'zod';

/**
 * One schema, used by the form, the API route and the CSV importer.
 * Client-side validation is convenience; this same object runs on the server,
 * which is where it counts.
 */
const money = z.coerce.number().finite();
const positive = money.positive('Must be greater than zero');

export const tradeSchema = z
  .object({
    accountId: z.string().uuid('Select an account'),
    strategyId: z.string().uuid().nullable().default(null),

    symbol: z
      .string()
      .trim()
      .min(1, 'Symbol is required')
      .max(32)
      // Blocks control characters and angle brackets at the edge, before the
      // value reaches storage or an export. Escaping happens at render too.
      .regex(/^[A-Za-z0-9._/\-:]+$/, 'Use letters, numbers, . _ - / : only')
      .transform((s) => s.toUpperCase()),

    market: z.enum(['forex', 'crypto', 'futures', 'stocks', 'options', 'indices']),
    direction: z.enum(['long', 'short']),
    status: z.enum(['open', 'closed', 'cancelled']).default('open'),

    openedAt: z.string().datetime({ offset: true }),
    closedAt: z.string().datetime({ offset: true }).nullable().default(null),

    quantity: positive,
    contractSize: positive.default(1),
    entryPrice: positive,
    exitPrice: positive.nullable().default(null),
    stopLoss: positive.nullable().default(null),
    takeProfit: positive.nullable().default(null),

    fees: money.min(0).default(0),
    commission: money.min(0).default(0),
    swap: money.default(0),

    setup: z.string().trim().max(80).nullable().default(null),
    timeframe: z.string().trim().max(16).nullable().default(null),
    session: z.enum(['asia', 'london', 'newyork', 'overlap', 'other']).nullable().default(null),
    marketCondition: z.string().trim().max(80).nullable().default(null),
    emotion: z
      .enum(['calm', 'confident', 'fearful', 'greedy', 'revenge', 'fomo', 'impatient', 'bored'])
      .nullable()
      .default(null),
    confidence: z.coerce.number().int().min(1).max(10).nullable().default(null),
    executionRating: z.coerce.number().int().min(1).max(10).nullable().default(null),

    notes: z.string().max(10_000, 'Notes are limited to 10,000 characters').nullable().default(null),
    tags: z.array(z.string().trim().min(1).max(24)).max(20).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'closed' && v.exitPrice === null) {
      ctx.addIssue({ code: 'custom', path: ['exitPrice'], message: 'A closed trade needs an exit price' });
    }
    if (v.status === 'closed' && v.closedAt === null) {
      ctx.addIssue({ code: 'custom', path: ['closedAt'], message: 'A closed trade needs a close time' });
    }
    if (v.closedAt && v.closedAt < v.openedAt) {
      ctx.addIssue({ code: 'custom', path: ['closedAt'], message: 'Close time is before open time' });
    }
    // On a trade still being planned, a stop on the wrong side of entry is
    // almost always a typo. On a finished one it is usually a trailing stop
    // that was moved into profit before the close — real history, and
    // rejecting it would refuse most broker exports. R is left undefined for
    // those rather than inverted.
    if (v.stopLoss !== null && v.status !== 'closed') {
      const wrongSide =
        v.direction === 'long' ? v.stopLoss >= v.entryPrice : v.stopLoss <= v.entryPrice;
      if (wrongSide) {
        ctx.addIssue({
          code: 'custom',
          path: ['stopLoss'],
          message:
            v.direction === 'long'
              ? 'Stop must be below entry on a long'
              : 'Stop must be above entry on a short',
        });
      }
    }
    if (v.takeProfit !== null) {
      const wrongSide =
        v.direction === 'long' ? v.takeProfit <= v.entryPrice : v.takeProfit >= v.entryPrice;
      if (wrongSide) {
        ctx.addIssue({
          code: 'custom',
          path: ['takeProfit'],
          message:
            v.direction === 'long'
              ? 'Target must be above entry on a long'
              : 'Target must be below entry on a short',
        });
      }
    }
  });

export type TradeInput = z.input<typeof tradeSchema>;
export type TradeOutput = z.output<typeof tradeSchema>;
