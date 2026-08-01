import { z } from 'zod';

export const strategySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give this strategy a name')
    .max(60, 'Keep the name under 60 characters'),
  description: z.string().trim().max(500).nullable().default(null),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour')
    .default('#6e6bf5'),
  // One rule per line in the form; stored as an array so they can be counted
  // and, later, checked off before a trade.
  rules: z
    .string()
    .max(2000)
    .transform((value) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 20),
    )
    .default(''),
});
