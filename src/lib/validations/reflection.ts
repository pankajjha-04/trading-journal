import { z } from 'zod';

export const reflectionSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  preMarket: z.string().trim().max(4000).nullable().default(null),
  reflection: z.string().trim().max(4000).nullable().default(null),
  mood: z.coerce.number().int().min(1).max(10).nullable().default(null),
  discipline: z.coerce.number().int().min(1).max(10).nullable().default(null),
  followedRules: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  meditated: z.coerce.boolean().default(false),
});
