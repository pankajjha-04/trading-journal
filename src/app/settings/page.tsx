import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/profile-form';
import { DangerZone } from '@/components/settings/danger-zone';

export const metadata: Metadata = {
  title: 'Profile settings',
  robots: { index: false, follow: false },
};

/** Every IANA zone the runtime knows, so nobody has to find theirs in a short list. */
function timezones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  if (typeof supported === 'function') return supported('timeZone');
  return ['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, timezone, base_currency, theme')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="space-y-8">
      <ProfileForm
        email={profile?.email ?? user.email ?? ''}
        fullName={profile?.full_name ?? ''}
        timezone={profile?.timezone ?? 'UTC'}
        baseCurrency={profile?.base_currency ?? 'USD'}
        theme={profile?.theme ?? 'dark'}
        timezones={timezones()}
      />
      <DangerZone email={profile?.email ?? user.email ?? ''} />
    </div>
  );
}
