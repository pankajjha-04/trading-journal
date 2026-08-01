import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/data/trades';
import { Calculators } from '@/components/tools/calculators';

export const metadata: Metadata = {
  title: 'Calculators',
  robots: { index: false, follow: false },
};

export default async function ToolsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const accounts = await getAccounts(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Calculators</h1>
        <p className="mt-1 max-w-lg text-sm text-fg-muted">
          Work these out before the entry, not after. Nothing here is saved —
          it is a scratchpad.
        </p>
      </div>

      <Calculators accounts={accounts} />
    </div>
  );
}
