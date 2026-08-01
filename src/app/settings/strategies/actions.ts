'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { strategySchema } from '@/lib/validations/strategy';
import { echoValues } from '@/lib/forms/echo';
import type { ActionState } from '@/app/(auth)/actions';

function toFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

export async function saveStrategy(
  strategyId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = strategySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || null,
    color: formData.get('color') || '#6e6bf5',
    rules: formData.get('rules') ?? '',
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const payload = {
    user_id: user.id,
    name: parsed.data.name,
    description: parsed.data.description,
    color: parsed.data.color,
    rules: parsed.data.rules,
  };

  const { error } = strategyId
    ? await supabase
        .from('strategies')
        .update(payload)
        .eq('id', strategyId)
        .eq('user_id', user.id)
    : await supabase.from('strategies').insert({ ...payload, is_favorite: false });

  if (error) {
    if (error.code === '23505') {
      return {
        fieldErrors: { name: 'You already have a strategy with that name' },
        values: echoValues(formData, []),
        stamp: Date.now(),
      };
    }
    console.error('[strategy:save]', error.code, error.message);
    return { error: 'We could not save that strategy.' };
  }

  revalidatePath('/settings/strategies');
  return { success: strategyId ? 'Strategy updated.' : 'Strategy added.' };
}

export async function deleteStrategy(strategyId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Trades keep their history: the foreign key is ON DELETE SET NULL, so
  // removing a strategy never removes a trade.
  await supabase.from('strategies').delete().eq('id', strategyId).eq('user_id', user.id);
  revalidatePath('/settings/strategies');
}

export async function toggleFavourite(strategyId: string, next: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('strategies')
    .update({ is_favorite: next })
    .eq('id', strategyId)
    .eq('user_id', user.id);

  revalidatePath('/settings/strategies');
}
