'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface ScreenshotState {
  error?: string;
  success?: string;
}

/**
 * The file itself goes straight from the browser to storage — routing 5 MB of
 * image through a server action would double the transfer and blow the body
 * limit. This only records the row once the upload has landed.
 */
export async function recordScreenshot(input: {
  tradeId: string;
  storagePath: string;
  caption?: string | null;
}): Promise<ScreenshotState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The path must start with this user's id — that is what the storage policy
  // enforces, and re-checking here stops a mismatched row being written.
  if (!input.storagePath.startsWith(`${user.id}/`)) {
    return { error: 'That upload path is not valid.' };
  }

  const { data: trade } = await supabase
    .from('trades')
    .select('id')
    .eq('id', input.tradeId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!trade) return { error: 'That trade was not found.' };

  const { error } = await supabase.from('trade_screenshots').insert({
    user_id: user.id,
    trade_id: input.tradeId,
    storage_path: input.storagePath,
    caption: input.caption?.trim() || null,
  });

  if (error) {
    console.error('[screenshot:record]', error.code, error.message);
    return { error: 'The image uploaded but could not be attached.' };
  }

  revalidatePath(`/journal/${input.tradeId}/edit`);
  return { success: 'Screenshot attached.' };
}

export async function deleteScreenshot(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('trade_screenshots')
    .select('id, trade_id, storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) return;

  // Remove the object first: a stranded row is recoverable, a stranded file
  // is invisible and bills storage forever.
  await supabase.storage.from('screenshots').remove([row.storage_path]);
  await supabase.from('trade_screenshots').delete().eq('id', id).eq('user_id', user.id);

  revalidatePath(`/journal/${row.trade_id}/edit`);
}
