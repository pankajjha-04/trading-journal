import { z } from 'zod';

/** Contract multipliers that are safe defaults per market. */
export const DEFAULT_CONTRACT_SIZE: Record<string, number> = {
  crypto: 1,
  stocks: 1,
  indices: 1,
  options: 1,
  forex: 100_000,
  futures: 1,
};

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give this account a name')
    .max(60, 'Keep the name under 60 characters'),
  broker: z.string().trim().max(60).nullable().default(null),
  market: z.enum(['crypto', 'forex', 'futures', 'stocks', 'options', 'indices']),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'JPY']),
  startingBalance: z.coerce
    .number()
    .finite('Enter a number')
    .min(0, 'Starting balance cannot be negative')
    .max(1_000_000_000, 'That balance looks like a typo'),
});

export type AccountInput = z.input<typeof accountSchema>;
