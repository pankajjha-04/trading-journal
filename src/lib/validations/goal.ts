import { z } from 'zod';

export const goalSchema = z
  .object({
    accountId: z.string().uuid('Pick an account'),
    metric: z.enum([
      'net_pnl',
      'win_rate',
      'profit_factor',
      'trade_count',
      'max_risk',
      'discipline',
    ]),
    period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    target: z.coerce.number().finite('Enter a number').positive('Set a target above zero'),
  })
  .superRefine((value, ctx) => {
    // Percentages above 100 are almost always a mistyped currency amount.
    if (
      (value.metric === 'win_rate' || value.metric === 'discipline') &&
      value.target > 100
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'That is a percentage — it cannot go above 100',
      });
    }
  });

export type GoalInput = z.input<typeof goalSchema>;
