import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/(auth)/actions';
import { Sidebar } from '@/components/dashboard/sidebar';
import { CommandPalette } from '@/components/dashboard/command-palette';
import { Button } from '@/components/ui/button';

/**
 * One shell for every signed-in route. Each route segment needs its own
 * layout file, but they all render this — otherwise the header and sidebar
 * drift apart section by section.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <CommandPalette />
      <Sidebar isAdmin={isAdmin} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-4 border-b border-line px-8 py-3 lg:flex">
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-2xs text-fg-subtle xl:inline">
            ⌘K
          </kbd>
          <div className="text-right">
            <p className="text-xs font-medium">{profile?.full_name ?? user.email}</p>
            <p className="text-2xs text-fg-subtle">{profile?.email ?? user.email}</p>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              leadingIcon={<LogOut className="size-4" />}
            >
              Log out
            </Button>
          </form>
        </header>

        <main id="main" className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
