import { z } from 'zod';

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your name')
    .max(60, 'That name is too long'),
  timezone: z
    .string()
    .trim()
    .min(1, 'Pick a timezone')
    .max(64)
    // Sessions and the P&L calendar are computed from this, so a bad value
    // silently shifts every trade into the wrong day.
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'That timezone is not recognised'),
  baseCurrency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'JPY']),
  theme: z.enum(['dark', 'light', 'system']),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(72, 'Passwords are limited to 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ['password'],
    message: 'That is the password you already have',
  });

export const accountEditSchema = z.object({
  name: z.string().trim().min(1, 'Give this account a name').max(60),
  broker: z.string().trim().max(60).nullable().default(null),
  market: z.enum(['crypto', 'forex', 'futures', 'stocks', 'options', 'indices']),
  currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'AED', 'SGD', 'JPY']),
  startingBalance: z.coerce.number().finite().min(0).max(1_000_000_000),
});

/** Deleting is irreversible, so it takes the exact email, not a checkbox. */
export const deleteAccountSchema = z.object({
  confirmation: z.string().trim().toLowerCase(),
});
