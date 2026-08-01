'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { reflectionSchema } from '@/lib/validations/reflection';
import { echoValues } from '@/lib/forms/echo';
import type { ActionState } from '@/app/(auth)/actions';

export async function saveReflection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = reflectionSchema.safeParse({
    entryDate: formData.get('entryDate'),
    preMarket: formData.get('preMarket') || null,
    reflection: formData.get('reflection') || null,
    mood: formData.get('mood') || null,
    discipline: formData.get('discipline') || null,
    followedRules: formData.get('followedRules') || 'unknown',
    meditated: formData.get('meditated') === 'on',
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the values and try again.',
      values: echoValues(formData, []),
      stamp: Date.now(),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // One entry per day, so saving twice edits rather than duplicates.
  const { error } = await supabase.from('journal_entries').upsert(
    {
      user_id: user.id,
      entry_date: parsed.data.entryDate,
      pre_market: parsed.data.preMarket,
      reflection: parsed.data.reflection,
      mood: parsed.data.mood,
      discipline: parsed.data.discipline,
      followed_rules:
        parsed.data.followedRules === 'unknown' ? null : parsed.data.followedRules === 'yes',
      meditated: parsed.data.meditated,
    },
    { onConflict: 'user_id,entry_date' },
  );

  if (error) {
    console.error('[reflection:save]', error.code, error.message);
    return { error: 'We could not save that entry.' };
  }

  revalidatePath('/reflect');
  return { success: 'Saved.' };
}
