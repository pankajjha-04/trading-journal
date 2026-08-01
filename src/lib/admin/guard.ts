import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

/**
 * Every admin page calls this first. The role is read from the database on
 * each request — never from a cookie, a header, or anything the browser can
 * set. RLS enforces the same rule underneath, so a missed call here still
 * cannot leak another user's rows.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // A non-admin is sent to the dashboard rather than shown a 403. There is no
  // reason to confirm that an admin area exists.
  if (profile?.role !== 'admin') redirect('/dashboard');

  return { id: user.id, email: user.email ?? '' };
}
