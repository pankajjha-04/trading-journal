import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email')
  .max(254, 'That email is too long')
  .email('That does not look like an email address')
  .toLowerCase();

/**
 * Length beats character classes. A 12-character passphrase survives longer
 * than "P@ss1!" — so the rule is length, plus a check against the handful of
 * passwords that show up in every credential-stuffing list.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', '123456789', '1234567890',
  'qwertyuiop', 'letmein123', 'welcome123', 'admin12345', 'iloveyou1',
  'trustno1234', 'passw0rd123', 'abc123456', 'monkey12345',
]);

const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Passwords are limited to 72 characters')
  .refine((v) => !COMMON.has(v.toLowerCase()), {
    message: 'That password appears in known breach lists — pick another',
  });

export const loginSchema = z.object({
  email,
  // No strength rule on login: an existing password must not be rejected here.
  password: z.string().min(1, 'Enter your password'),
  next: z.string().startsWith('/').max(200).optional(),
});

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your name')
      .max(60, 'That name is too long'),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
