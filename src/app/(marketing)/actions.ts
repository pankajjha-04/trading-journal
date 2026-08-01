'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { clientKey, rateLimit } from '@/lib/auth/rate-limit';
import type { ActionState } from '@/app/(auth)/actions';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address'),
});

export async function subscribe(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message ?? 'Check that address' } };
  }

  const limit = rateLimit(clientKey(await headers(), 'newsletter'), {
    limit: 3,
    windowMs: 10 * 60_000,
    blockMs: 30 * 60_000,
  });

  // A rate-limited request returns the same message as a successful one, so
  // the form cannot be used to probe which addresses are already on the list.
  if (limit.allowed) {
    const supabase = await createClient();
    await supabase
      .from('newsletter_subscribers')
      .insert({ email: parsed.data.email, source: 'landing' });
  }

  return { success: 'You are on the list. No more than one email a month.' };
}
